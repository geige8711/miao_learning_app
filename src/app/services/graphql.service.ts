import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { gql } from '@apollo/client/core';
import { forkJoin, Observable, of, from, timer, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Tag, WordItem, CreateWordItemInput } from '../../types/word.types';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import {
  Category,
  Quiz,
  CategoryWithQuizzes,
  QuizInput,
  QuizOptionCreateInput,
} from '../../types/quiz.types';

@Injectable({
  providedIn: 'root',
})
export class GraphqlService {
  private hygraphUrl = environment.hygraphUrl;
  private hygraphToken = environment.hygraphToken;

  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${environment.hygraphToken}`,
  });

  constructor(private apollo: Apollo, private http: HttpClient) {}

  private executeQuery<T>(query: string, variables?: any): Observable<T> {
    return this.http
      .post<{ data: T; errors?: any[] }>(
        environment.hygraphUrl,
        { query, variables },
        { headers: this.headers }
      )
      .pipe(
        map((response) => {
          if (response.errors) {
            throw new Error(response.errors.map((e) => e.message).join('\n'));
          }
          return response.data;
        })
      );
  }

  /**
   * Helper method to fetch all results using cursor-based pagination
   * @param queryFn Function that returns a GraphQL query with cursor pagination
   * @param variables Variables for the query
   * @param connectionPath Path to the connection in the response (e.g., 'tagsConnection', 'wordItemsConnection')
   * @param limit Number of items per page (default: 100)
   */
  private fetchAllWithCursor<T>(
    queryFn: (first: number, after?: string) => string,
    variables: any,
    connectionPath: string,
    limit: number = 100
  ): Observable<T[]> {
    return new Observable((observer) => {
      let allResults: T[] = [];
      let hasNextPage = true;
      let after: string | undefined = undefined;

      const fetchPage = () => {
        const query = queryFn(limit, after);
        
        this.apollo
          .query<any>({
            query: gql`
              ${query}
            `,
            variables: { ...variables, first: limit, after: after || undefined },
          })
          .pipe(
            map((result) => {
              const connection = this.getNestedValue(result.data, connectionPath);
              return connection;
            })
          )
          .subscribe({
            next: (connection) => {
              // Extract results from edges
              const results = connection.edges.map((edge: any) => edge.node);
              allResults.push(...results);
              
              // Update pagination info
              hasNextPage = connection.pageInfo.hasNextPage;
              after = connection.pageInfo.endCursor;
              
              if (hasNextPage) {
                // Add small delay to avoid overwhelming the API
                setTimeout(() => fetchPage(), 100);
              } else {
                observer.next(allResults);
                observer.complete();
              }
            },
            error: (error) => {
              observer.error(error);
            },
          });
      };

      fetchPage();
    });
  }

  /**
   * Helper method to get nested object values by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  createAsset(file: File, fileName?: string): Observable<any> {
    const mutation = gql`
      mutation CreateAsset($data: AssetCreateInput!) {
        createAsset(data: $data) {
          id
          url
          upload {
            status
            expiresAt
            requestPostData {
              url
              date
              key
              signature
              algorithm
              policy
              credential
              securityToken
            }
          }
        }
      }
    `;

    const variables = {
      data: {
        fileName: fileName || file.name,
        // Add any other required fields from your HyGraph schema
      },
    };

    return this.apollo.mutate({
      mutation,
      variables,
    });
  }

  // Upload file to storage
  uploadFile(file: File, uploadData: any): Observable<any> {
    const formData = new FormData();

    // Add all required fields from the upload data
    formData.append('key', uploadData.key);
    formData.append('X-Amz-Date', uploadData.date);
    formData.append('X-Amz-Signature', uploadData.signature);
    formData.append('X-Amz-Algorithm', uploadData.algorithm);
    formData.append('X-Amz-Credential', uploadData.credential);
    formData.append('X-Amz-Security-Token', uploadData.securityToken);
    formData.append('policy', uploadData.policy);
    formData.append('file', file);

    return this.http.post(uploadData.url, formData);
  }

  publishAsset(assetId: string): Observable<any> {
    const PUBLISH_ASSET = gql`
      mutation PublishAsset($id: ID!) {
        publishAsset(where: { id: $id }) {
          id
          url
          fileName
        }
      }
    `;

    return this.apollo.mutate({
      mutation: PUBLISH_ASSET,
      variables: { id: assetId },
    });
  }

  updateAssetWithUploadData(assetId: string, file: File): Observable<any> {
    const UPDATE_ASSET = gql`
      mutation UpdateAsset($id: ID!, $data: AssetUpdateInput!) {
        updateAsset(where: { id: $id }, data: $data) {
          id
          status
        }
      }
    `;

    return this.apollo.mutate({
      mutation: UPDATE_ASSET,
      variables: {
        id: assetId,
        data: {
          size: file.size,
          mimeType: file.type,
          status: 'UPLOADED', // or whatever status your schema expects
        },
      },
    });
  }

  createAndUploadAsset(file: File, fileName?: string): Observable<any> {
    return this.createAsset(file, fileName).pipe(
      switchMap((result) => {
        const uploadData = result.data.createAsset.upload.requestPostData;
        return this.uploadFile(file, uploadData).pipe(
          switchMap(() => {
            // Wait a moment to ensure the upload is fully processed
            return timer(2000).pipe(
              switchMap(() => this.publishAsset(result.data.createAsset.id)),
              catchError((error) => {
                console.error(
                  'Publishing failed, trying to update first:',
                  error
                );
                return this.updateAssetWithUploadData(
                  result.data.createAsset.id,
                  file
                ).pipe(
                  switchMap(() => this.publishAsset(result.data.createAsset.id))
                );
              })
            );
          })
        );
      })
    );
  }

  // Get all tags with their word items
  getTags(): Observable<Tag[]> {
    const getTagsQuery = (first: number, after?: string) => `
      query GetTags($first: Int!, $after: String) {
        tagsConnection(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              tagName
              createdAt
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<Tag>(
      getTagsQuery,
      {},
      'tagsConnection'
    ).pipe(
      switchMap(tags => {
        // For each tag, get the word item count using nested pagination
        const countObservables = tags.map(tag => 
          this.getWordItemCountForTag(tag.id).pipe(
            map(count => ({ ...tag, wordItemCount: count }))
          )
        );
        
        return forkJoin(countObservables);
      }),
      map(tagsWithCounts => 
        tagsWithCounts.map(tag => ({
          ...tag,
          wordItem: Array(tag.wordItemCount || 0).fill({})
        }))
      )
    );
  }

  private getWordItemCountForTag(tagId: string): Observable<number> {
    // Use pagination to get all word items for accurate count
    const getWordItemCountQuery = `
      query GetWordItemCount($tagId: ID!, $first: Int!, $skip: Int!) {
        tag(where: { id: $tagId }) {
          wordItem(first: $first, skip: $skip) {
            id
          }
        }
      }
    `;

    return new Observable((observer) => {
      let totalCount = 0;
      let skip = 0;
      const pageSize = 100; // Use the correct Hygraph limit
      let hasMore = true;

      const fetchPage = () => {
        this.apollo
          .query<any>({
            query: gql`
              ${getWordItemCountQuery}
            `,
            variables: { tagId, first: pageSize, skip },
          })
          .pipe(
            map((result) => {
              const wordItems = result.data?.tag?.wordItem || [];
              return wordItems;
            })
          )
          .subscribe({
            next: (wordItems) => {
              totalCount += wordItems.length;
              
              // If we got fewer items than requested, we've reached the end
              if (wordItems.length < pageSize) {
                hasMore = false;
              } else {
                skip += pageSize;
              }

              if (hasMore) {
                fetchPage();
              } else {
                observer.next(totalCount);
                observer.complete();
              }
            },
            error: (error) => {
              observer.error(error);
            },
          });
      };

      fetchPage();
    });
  }

  private getCollectedWordItemCountForTag(tagId: string): Observable<number> {
    // Use pagination to get all collected word items for accurate count
    const getCollectedWordItemCountQuery = `
      query GetCollectedWordItemCount($tagId: ID!, $first: Int!, $skip: Int!) {
        tag(where: { id: $tagId }) {
          wordItem(where: { isCollected: true }, first: $first, skip: $skip) {
            id
          }
        }
      }
    `;

    return new Observable((observer) => {
      let totalCount = 0;
      let skip = 0;
      const pageSize = 100; // Use the correct Hygraph limit
      let hasMore = true;

      const fetchPage = () => {
        this.apollo
          .query<any>({
            query: gql`
              ${getCollectedWordItemCountQuery}
            `,
            variables: { tagId, first: pageSize, skip },
          })
          .pipe(
            map((result) => {
              const wordItems = result.data?.tag?.wordItem || [];
              return wordItems;
            })
          )
          .subscribe({
            next: (wordItems) => {
              totalCount += wordItems.length;
              
              // If we got fewer items than requested, we've reached the end
              if (wordItems.length < pageSize) {
                hasMore = false;
              } else {
                skip += pageSize;
              }

              if (hasMore) {
                fetchPage();
              } else {
                observer.next(totalCount);
                observer.complete();
              }
            },
            error: (error) => {
              observer.error(error);
            },
          });
      };

      fetchPage();
    });
  }

  // Get all tags with their word items
  getCollectedTags(): Observable<Tag[]> {
    const getCollectedTagsQuery = (first: number, after?: string) => `
      query GetCollectedTags($first: Int!, $after: String) {
        tagsConnection(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              tagName
              createdAt
              updatedAt
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<Tag>(
      getCollectedTagsQuery,
      {},
      'tagsConnection'
    ).pipe(
      switchMap(tags => {
        // For each tag, get the collected word item count using nested pagination
        const countObservables = tags.map(tag => 
          this.getCollectedWordItemCountForTag(tag.id).pipe(
            map(count => ({ ...tag, wordItemCount: count }))
          )
        );
        
        return forkJoin(countObservables);
      }),
      map(tagsWithCounts => 
        tagsWithCounts.map(tag => ({
          ...tag,
          wordItem: Array(tag.wordItemCount || 0).fill({})
        }))
      ),
      map((tags) => tags.filter((tag) => tag.wordItem.length > 0))
    );
  }

  // Get word items by tag
  getWordItemsByTag(tagId: string): Observable<WordItem[]> {
    const getWordItemsByTagQuery = (first: number, after?: string) => `
      query GetWordItemsByTag($tagId: ID!, $first: Int!, $after: String) {
        tag(where: { id: $tagId }) {
          wordItem(first: $first, after: $after) {
            id
            item
            meaning
            isKnown
            isCollected
            viewTime
            createdAt
            updatedAt
            tags {
              id
              tagName
            }
            examples {
              id
              sentence
              meaning
            }
            images {
              id
              url
            }
          }
        }
      }
    `;

    // Use a custom pagination approach for single tag queries
    return new Observable((observer) => {
      let allWordItems: WordItem[] = [];
      let after: string | undefined = undefined;
      const pageSize = 100; // Use the correct Hygraph limit
      let hasMore = true;

      const fetchPage = () => {
        this.apollo
          .query<any>({
            query: gql`
              ${getWordItemsByTagQuery(pageSize, after)}
            `,
            variables: { tagId, first: pageSize, after },
          })
          .pipe(
            map((result) => {
              const wordItems = result.data?.tag?.wordItem || [];
              return wordItems;
            })
          )
          .subscribe({
            next: (wordItems) => {
              allWordItems = allWordItems.concat(wordItems);
              
              // If we got fewer items than requested, we've reached the end
              if (wordItems.length < pageSize) {
                hasMore = false;
              } else {
                // For cursor pagination, we need to get the cursor from the last item
                // Since we're not using a connection, we'll use the ID as a simple approach
                after = wordItems[wordItems.length - 1]?.id;
              }

              if (hasMore && after) {
                fetchPage();
              } else {
                observer.next(allWordItems);
                observer.complete();
              }
            },
            error: (error) => {
              observer.error(error);
            },
          });
      };

      fetchPage();
    });
  }

  // Get word items by tag
  getCollectedWordItemsByTag(tagId: string): Observable<WordItem[]> {
    const getCollectedWordItemsByTagQuery = (first: number, after?: string) => `
      query GetCollectedWordItemsByTag($tagId: ID!, $first: Int!, $after: String) {
        tag(where: { id: $tagId }) {
          wordItem(where: { isCollected: true }, first: $first, after: $after) {
            id
            item
            meaning
            isKnown
            isCollected
            viewTime
            createdAt
            updatedAt
            tags {
              id
              tagName
            }
            examples {
              id
              sentence
              meaning
            }
            images {
              id
              url
            }
          }
        }
      }
    `;

    // Use a custom pagination approach for single tag queries
    return new Observable((observer) => {
      let allWordItems: WordItem[] = [];
      let after: string | undefined = undefined;
      const pageSize = 100; // Use the correct Hygraph limit
      let hasMore = true;

      const fetchPage = () => {
        this.apollo
          .query<any>({
            query: gql`
              ${getCollectedWordItemsByTagQuery(pageSize, after)}
            `,
            variables: { tagId, first: pageSize, after },
          })
          .pipe(
            map((result) => {
              const wordItems = result.data?.tag?.wordItem || [];
              return wordItems;
            })
          )
          .subscribe({
            next: (wordItems) => {
              allWordItems = allWordItems.concat(wordItems);
              
              // If we got fewer items than requested, we've reached the end
              if (wordItems.length < pageSize) {
                hasMore = false;
              } else {
                // For cursor pagination, we need to get the cursor from the last item
                // Since we're not using a connection, we'll use the ID as a simple approach
                after = wordItems[wordItems.length - 1]?.id;
              }

              if (hasMore && after) {
                fetchPage();
              } else {
                observer.next(allWordItems);
                observer.complete();
              }
            },
            error: (error) => {
              observer.error(error);
            },
          });
      };

      fetchPage();
    });
  }

  updateWordViewTimestamp(
    wordItemId: string,
    viewTimes: string[]
  ): Observable<WordItem> {
    const UPDATE_AND_PUBLISH_WORD_ITEM = gql`
      mutation UpdateAndPublishWordItem($id: ID!, $viewTimes: [Date!]!) {
        update: updateWordItem(
          where: { id: $id }
          data: { viewTime: $viewTimes }
        ) {
          id
          item
          viewTime
          updatedAt
        }
        publish: publishWordItem(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate<{
        update: WordItem;
        publish: { id: string };
      }>({
        mutation: UPDATE_AND_PUBLISH_WORD_ITEM,
        variables: {
          id: wordItemId,
          viewTimes,
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.update) {
            throw new Error('Failed to update view timestamps');
          }
          return result.data.update;
        }),
        catchError((error) => {
          console.error('Error updating/publishing word item:', error);
          throw new Error('Failed to update and publish word item');
        })
      );
  }

  createWordItem(wordItemData: CreateWordItemInput): Observable<WordItem> {
    // Check if there are images to upload
    const hasImages = wordItemData.images && wordItemData.images.length > 0;

    if (hasImages) {
      // Handle case with images
      const uploadObservables = wordItemData.images!.map((file) =>
        this.createAndUploadAsset(file).pipe(
          catchError((error) => {
            console.error(`File ${file.name} upload failed:`, error);
            throw new Error(`File upload failed: ${file.name}`);
          })
        )
      );

      return forkJoin(uploadObservables).pipe(
        switchMap((uploadResults) => {
          // Prepare image connections outside the GQL template
          const imageConnections = uploadResults.map((res) => ({
            id: res.data.publishAsset.id,
          }));

          return this.createWordItemMutation(wordItemData, imageConnections);
        })
      );
    } else {
      // Handle case without images - skip upload process entirely
      return this.createWordItemMutation(wordItemData, []);
    }
  }

  private createWordItemMutation(
    wordItemData: CreateWordItemInput,
    imageConnections: any[]
  ): Observable<WordItem> {
    // Prepare tag connections
    const existingTags = wordItemData.tags
      .filter((tag) => tag.isExisting && tag.tagId)
      .map((tag) => ({ id: tag.tagId }));

    const newTags = wordItemData.tags
      .filter((tag) => !tag.isExisting)
      .map((tag) => ({ tagName: tag.name }));

    const CREATE_WORD_ITEM = gql`
      mutation CreateWordItem(
        $item: String!
        $meaning: String!
        $examples: [ExampleCreateInput!]
        $isKnown: Boolean
        $isCollected: Boolean
        $imageConnections: [AssetWhereUniqueInput!]
        $existingTags: [TagWhereUniqueInput!]
        $newTags: [TagCreateInput!]
      ) {
        createWordItem(
          data: {
            item: $item
            meaning: $meaning
            isKnown: $isKnown
            isCollected: $isCollected
            tags: { connect: $existingTags, create: $newTags }
            examples: { create: $examples }
            images: { connect: $imageConnections }
          }
        ) {
          id
          item
          meaning
          tags {
            id
            tagName
          }
          examples {
            id
            sentence
            meaning
          }
          images {
            id
            url
            fileName
          }
        }
      }
    `;

    return this.apollo
      .mutate<{ createWordItem: WordItem }>({
        mutation: CREATE_WORD_ITEM,
        variables: {
          item: wordItemData.item,
          meaning: wordItemData.meaning,
          examples: wordItemData.examples,
          isKnown: wordItemData.isKnown ?? false,
          isCollected: wordItemData.isCollected ?? false,
          imageConnections,
          existingTags,
          newTags,
        },
        context: {
          headers: {
            Authorization: `Bearer ${this.hygraphToken}`,
          },
        },
      })
      .pipe(
        switchMap((result) => {
          if (!result?.data?.createWordItem) {
            throw new Error('WordItem creation failed: No data returned');
          }
          const createdWordItem = result.data.createWordItem;

          // 添加发布操作
          const PUBLISH_WORD_ITEM = gql`
            mutation PublishWordItem($id: ID!) {
              publishWordItem(where: { id: $id }) {
                id
                item
                meaning
                isKnown
                isCollected
                tags {
                  id
                  tagName
                }
                examples {
                  id
                  sentence
                  meaning
                }
                images {
                  id
                  url
                  fileName
                }
              }
            }
          `;

          return this.apollo
            .mutate<{ publishWordItem: WordItem }>({
              mutation: PUBLISH_WORD_ITEM,
              variables: { id: createdWordItem.id },
              context: {
                headers: {
                  Authorization: `Bearer ${this.hygraphToken}`,
                },
              },
            })
            .pipe(
              map((publishResult) => {
                if (!publishResult?.data?.publishWordItem) {
                  throw new Error('WordItem publishing failed');
                }
                return publishResult.data.publishWordItem;
              }),
              // 处理发布错误（可选：回退返回未发布的数据）
              catchError((error) => {
                console.error(
                  'Publishing failed, returning draft version',
                  error
                );
                return of(createdWordItem);
              })
            );
        })
      );
  }

  markWordItemUnknown(
    wordItemId: string,
    isKnown: boolean
  ): Observable<WordItem> {
    // 1. First define both mutations
    const UPDATE_WORD_ITEM = gql`
      mutation UpdateWordItem($id: ID!, $isKnown: Boolean!) {
        updateWordItem(where: { id: $id }, data: { isKnown: $isKnown }) {
          id
          item
          isKnown
          updatedAt
        }
      }
    `;

    const PUBLISH_WORD_ITEM = gql`
      mutation PublishWordItem($id: ID!) {
        publishWordItem(where: { id: $id }) {
          id
        }
      }
    `;

    // 2. Execute mutations sequentially
    return this.apollo
      .mutate<{ updateWordItem: WordItem }>({
        mutation: UPDATE_WORD_ITEM,
        variables: { id: wordItemId, isKnown },
      })
      .pipe(
        switchMap((updateResult) => {
          const updatedItem = updateResult.data!.updateWordItem;

          return this.apollo
            .mutate({
              mutation: PUBLISH_WORD_ITEM,
              variables: { id: wordItemId },
            })
            .pipe(
              map(() => updatedItem) // Return the updated item after publishing
            );
        }),
        // Optional: Add error handling
        catchError((error) => {
          console.error('Error updating/publishing word item:', error);
          return throwError(
            () => new Error('Failed to update word item status')
          );
        })
      );
  }

  markWordItemCollected(
    wordItemId: string,
    isCollected: boolean
  ): Observable<WordItem> {
    // Update mutation
    const UPDATE_WORD_ITEM = gql`
      mutation UpdateWordItem($id: ID!, $isCollected: Boolean!) {
        updateWordItem(
          where: { id: $id }
          data: { isCollected: $isCollected }
        ) {
          id
          item
          isCollected
          updatedAt
        }
      }
    `;

    // Publish mutation
    const PUBLISH_WORD_ITEM = gql`
      mutation PublishWordItem($id: ID!) {
        publishWordItem(where: { id: $id }) {
          id
          item
          isCollected
        }
      }
    `;

    return this.apollo
      .mutate<{ updateWordItem: WordItem }>({
        mutation: UPDATE_WORD_ITEM,
        variables: { id: wordItemId, isCollected },
      })
      .pipe(
        // Chain the publish mutation after successful update
        switchMap((result) => {
          const updatedItem = result.data!.updateWordItem;
          return this.apollo
            .mutate({
              mutation: PUBLISH_WORD_ITEM,
              variables: { id: wordItemId },
            })
            .pipe(
              // Return the original updated item
              map(() => updatedItem)
            );
        })
      );
  }

  // Category methods
  getCategories(): Observable<Category[]> {
    const getCategoriesQuery = (first: number, after?: string) => `
      query GetCategories($first: Int!, $after: String) {
        categoriesConnection(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              categoryName
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<Category>(
      getCategoriesQuery,
      {},
      'categoriesConnection'
    );
  }

  // Quiz methods
  getQuizzesByCategory(categoryId: string): Observable<Quiz[]> {
    const getQuizzesByCategoryQuery = (first: number, after?: string) => `
      query GetQuizzesByCategory($categoryId: ID!, $first: Int!, $after: String) {
        quizzesConnection(where: { category: { id: { equals: $categoryId } } }, first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              quizContent
              quizImages {
                url
              }
              quizOptions {
                ... on QuizOption {
                  quizOptionText
                  optionImage {
                    url
                  }
                }
              }
              correctAnswer
              isCollected
              viewTime
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<Quiz>(
      getQuizzesByCategoryQuery,
      { categoryId },
      'quizzesConnection'
    ).pipe(
      map((quizzes) => {
        if (!quizzes || quizzes.length === 0) {
          throw new Error('No quizzes found for this category');
        }
        return quizzes.map((quiz) => ({
          ...quiz,
          // Ensure quizOptions is always an array and includes 'id'
          quizOptions:
            quiz.quizOptions?.map((option) => ({
              id: option.id,
              quizOptionText: option.quizOptionText,
              optionImage: option.optionImage || undefined,
            })) || [],
        }));
      })
    );
  }

  getCategoriesWithIncorrectQuizzes(): Observable<CategoryWithQuizzes[]> {
    const getCategoriesWithQuizzesQuery = (first: number, after?: string) => `
      query GetCategoriesWithQuizzes($first: Int!, $after: String) {
        categoriesConnection(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              categoryName
              quiz {
                id
                correctAnswer
                isCollected
                viewTime
                quizContent
                quizImages {
                  url
                }
                quizOptions {
                  ... on QuizOption {
                    quizOptionText
                    optionImage {
                      url
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<CategoryWithQuizzes>(
      getCategoriesWithQuizzesQuery,
      {},
      'categoriesConnection'
    ).pipe(
      map((categories) => {
        return categories.map((category) => ({
          ...category,
          quiz:
            category.quiz
              ?.map((quiz) => ({
                ...quiz,
                isCollected: quiz.isCollected ?? false, // Default to false if null
                quizOptions: quiz.quizOptions || [],
              }))
              .filter((quiz) => quiz.isCollected) || [],
        }));
      }),
      catchError((error) => {
        console.error('Error fetching categories:', error);
        return of([]);
      })
    );
  }

  getIncorrectQuizzes(): Observable<Quiz[]> {
    const getIncorrectQuizzesQuery = (first: number, after?: string) => `
      query GetIncorrectQuizzes($first: Int!, $after: String) {
        quizzesConnection(where: { isCollected: true }, first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              quizContent
              correctAnswer
              quizOptions {
                ... on QuizOption {
                  quizOptionText
                  optionImage {
                    url
                  }
                }
              }
              category {
                id
                categoryName
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    return this.fetchAllWithCursor<Quiz>(
      getIncorrectQuizzesQuery,
      {},
      'quizzesConnection'
    );
  }

  createCategory(categoryName: string): Observable<Category> {
    const CREATE_CATEGORY = gql`
      mutation CreateCategory($categoryName: String!) {
        createCategory(data: { categoryName: $categoryName }) {
          id
          categoryName
        }
      }
    `;

    const PUBLISH_CATEGORY = gql`
      mutation PublishCategory($id: ID!) {
        publishCategory(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate<{ createCategory: Category }>({
        mutation: CREATE_CATEGORY,
        variables: { categoryName },
      })
      .pipe(
        switchMap((result) => {
          if (!result.data?.createCategory) {
            throw new Error('Category creation failed');
          }

          return this.apollo
            .mutate({
              mutation: PUBLISH_CATEGORY,
              variables: { id: result.data.createCategory.id },
            })
            .pipe(
              map(() => result!.data!.createCategory),
              catchError((publishError) => {
                console.error(
                  'Failed to publish category, returning draft version',
                  publishError
                );
                return of(result!.data!.createCategory);
              })
            );
        })
      );
  }

  createQuiz(quizData: QuizInput): Observable<Quiz> {
    // Upload quiz images first
    const quizImagesUpload$ = quizData.quizImages?.length
      ? forkJoin(
          quizData.quizImages.map((file) => this.createAndUploadAsset(file))
        )
      : of([]);

    // Handle option images - return empty array if no images to upload
    const optionsWithImages = quizData.quizOptions.filter(
      (option) => option.optionImage
    );
    const optionImagesUpload$ =
      optionsWithImages.length > 0
        ? forkJoin(
            optionsWithImages.map((option) =>
              this.createAndUploadAsset(option.optionImage!)
            )
          )
        : of([]);

    return forkJoin([quizImagesUpload$, optionImagesUpload$]).pipe(
      switchMap(([quizImageResults, optionImageResults]) => {
        // Prepare image connections
        const quizImageConnections = quizImageResults.map((res) => ({
          id: res.data.publishAsset.id,
        }));

        // Prepare option data with image connections
        let optionImageIndex = 0;
        const quizOptionsData: QuizOptionCreateInput[] =
          quizData.quizOptions.map((option) => {
            const optionData: QuizOptionCreateInput = {
              quizOptionText: option.quizOptionText,
            };

            if (option.optionImage) {
              optionData.optionImage = {
                connect:
                  optionImageResults[optionImageIndex++].data.publishAsset.id,
              };
            }

            return optionData;
          });

        const quizQuizOptionsCreateInputs: any[] = quizOptionsData.map(
          (option) => ({
            QuizOption: { ...option },
          })
        );

        // Prepare category connections
        const existingCategories = quizData.categories
          .filter((cat) => cat.isExisting && cat.categoryId)
          .map((cat) => ({ id: cat.categoryId }));

        const newCategories = quizData.categories
          .filter((cat) => !cat.isExisting)
          .map((cat) => ({ categoryName: cat.name }));

        const CREATE_QUIZ = gql`
          mutation CreateQuiz(
            $quizContent: String!
            $correctAnswer: String!
            $quizOptions: [quizQuizOptionsCreateInput!]
            $quizImages: [AssetWhereUniqueInput!]
            $isCollected: Boolean
            $existingCategories: [CategoryWhereUniqueInput!]
            $newCategories: [CategoryCreateInput!]
          ) {
            createQuiz(
              data: {
                quizContent: $quizContent
                correctAnswer: $correctAnswer
                quizOptions: { create: $quizOptions }
                quizImages: { connect: $quizImages }
                isCollected: $isCollected
                category: {
                  connect: $existingCategories
                  create: $newCategories
                }
              }
            ) {
              id
              quizContent
              correctAnswer
              isCollected
              quizOptions {
                ... on QuizOption {
                  id
                  quizOptionText
                  optionImage {
                    url
                  }
                }
              }
              quizImages {
                url
              }
              category {
                id
                categoryName
              }
            }
          }
        `;

        const PUBLISH_QUIZ = gql`
          mutation PublishQuiz($id: ID!) {
            publishQuiz(where: { id: $id }) {
              id
            }
          }
        `;

        return this.apollo
          .mutate<{ createQuiz: Quiz }>({
            mutation: CREATE_QUIZ,
            variables: {
              quizContent: quizData.quizContent,
              correctAnswer: quizData.correctAnswer,
              quizOptions: quizQuizOptionsCreateInputs,
              quizImages: quizImageConnections,
              isCollected: quizData.isCollected || false,
              existingCategories,
              newCategories,
            },
          })
          .pipe(
            switchMap((createResult) => {
              if (!createResult.data?.createQuiz) {
                throw new Error('Quiz creation failed');
              }

              return this.apollo
                .mutate({
                  mutation: PUBLISH_QUIZ,
                  variables: { id: createResult.data.createQuiz.id },
                })
                .pipe(
                  map(() => createResult.data!.createQuiz),
                  catchError((publishError) => {
                    console.error(
                      'Failed to publish quiz, returning draft version',
                      publishError
                    );
                    return of(createResult.data!.createQuiz);
                  })
                );
            })
          );
      })
    );
  }

  updateQuizViewTime(quizId: string, viewTimes: string[]): Observable<Quiz> {
    // Create properly formatted DateTime string
    const now = new Date().toISOString();
    const newViewTimes = [now, ...viewTimes];

    const UPDATE_QUIZ_VIEW_TIME = gql`
      mutation UpdateQuizViewTime($id: ID!, $newViewTime: [Date!]!) {
        updateQuiz(where: { id: $id }, data: { viewTime: $newViewTime }) {
          id
          viewTime
        }
        publishQuiz(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate<{ updateQuiz: Quiz }>({
        mutation: UPDATE_QUIZ_VIEW_TIME,
        variables: {
          id: quizId,
          newViewTime: newViewTimes,
        },
      })
      .pipe(
        map((result) => {
          if (!result.data?.updateQuiz) {
            throw new Error('Failed to update view time');
          }
          return result.data.updateQuiz;
        })
      );
  }

  markQuizCollected(quizId: string, isCollected: boolean): Observable<Quiz> {
    const MARK_QUIZ_COLLECTED = gql`
      mutation MarkQuizCollected($id: ID!, $isCollected: Boolean!) {
        updateQuiz(where: { id: $id }, data: { isCollected: $isCollected }) {
          id
          isCollected
        }
        publishQuiz(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate<{ updateQuiz: Quiz }>({
        mutation: MARK_QUIZ_COLLECTED,
        variables: { id: quizId, isCollected },
      })
      .pipe(map((result) => result.data!.updateQuiz));
  }

  publishQuizOption(optionId: string): Observable<any> {
    const PUBLISH_QUIZ_OPTION = gql`
      mutation PublishQuizOption($id: ID!) {
        publishQuizOption(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate({
        mutation: PUBLISH_QUIZ_OPTION,
        variables: { id: optionId },
      })
      .pipe(
        catchError((error) => {
          console.error(`Failed to publish quiz option ${optionId}:`, error);
          throw error;
        })
      );
  }

  createQuizNew(quizData: QuizInput): Observable<Quiz> {
    // Upload quiz images first
    const quizImagesUpload$ = quizData.quizImages?.length
      ? forkJoin(
          quizData.quizImages.map((file) => this.createAndUploadAsset(file))
        )
      : of([]);

    // Handle option images - return empty array if no images to upload
    const optionsWithImages = quizData.quizOptions.filter(
      (option) => option.optionImage
    );
    const optionImagesUpload$ =
      optionsWithImages.length > 0
        ? forkJoin(
            optionsWithImages.map((option) =>
              this.createAndUploadAsset(option.optionImage!)
            )
          )
        : of([]);

    return forkJoin([quizImagesUpload$, optionImagesUpload$]).pipe(
      switchMap(([quizImageResults, optionImageResults]) => {
        // Prepare image connections
        const quizImageConnections = quizImageResults.map((res) => ({
          id: res.data.publishAsset.id,
        }));

        // Prepare option data with image connections
        let optionImageIndex = 0;
        const quizOptionsData: QuizOptionCreateInput[] =
          quizData.quizOptions.map((option) => {
            const optionData: QuizOptionCreateInput = {
              quizOptionText: option.quizOptionText,
            };

            if (option.optionImage) {
              optionData.optionImage = {
                connect:
                  optionImageResults[optionImageIndex++].data.publishAsset.id,
              };
            }

            return optionData;
          });

        const quizQuizOptionsCreateInputs: any[] = quizOptionsData.map(
          (option) => ({
            QuizOption: { ...option },
          })
        );

        // Prepare category connections
        const existingCategories = quizData.categories
          .filter((cat) => cat.isExisting && cat.categoryId)
          .map((cat) => ({ id: cat.categoryId }));

        const newCategories = quizData.categories
          .filter((cat) => !cat.isExisting)
          .map((cat) => ({ categoryName: cat.name }));

        const CREATE_QUIZ = gql`
          mutation CreateQuiz(
            $quizContent: String!
            $correctAnswer: String!
            $quizOptions: [quizQuizOptionsCreateInput!]
            $quizImages: [AssetWhereUniqueInput!]
            $isCollected: Boolean
            $existingCategories: [CategoryWhereUniqueInput!]
            $newCategories: [CategoryCreateInput!]
          ) {
            createQuiz(
              data: {
                quizContent: $quizContent
                correctAnswer: $correctAnswer
                quizOptions: { create: $quizOptions }
                quizImages: { connect: $quizImages }
                isCollected: $isCollected
                category: {
                  connect: $existingCategories
                  create: $newCategories
                }
              }
            ) {
              id
              quizContent
              correctAnswer
              isCollected
              quizOptions {
                ... on QuizOption {
                  id
                  quizOptionText
                  optionImage {
                    url
                  }
                }
              }
              quizImages {
                url
              }
              category {
                id
                categoryName
              }
            }
          }
        `;

        return this.apollo
          .mutate<{ createQuiz: Quiz }>({
            mutation: CREATE_QUIZ,
            variables: {
              quizContent: quizData.quizContent,
              correctAnswer: quizData.correctAnswer,
              quizOptions: quizQuizOptionsCreateInputs,
              quizImages: quizImageConnections,
              isCollected: quizData.isCollected || false,
              existingCategories,
              newCategories,
            },
          })
          .pipe(
            switchMap((createResult) => {
              if (!createResult.data?.createQuiz) {
                throw new Error('Quiz creation failed');
              }

              // Publish all quiz options first
              const optionPublishObservables = createResult.data.createQuiz
                .quizOptions!.filter((option) => option.id) // Ensure we have an ID
                .map((option) => this.publishQuizOption(option.id));

              return optionPublishObservables.length > 0
                ? forkJoin(optionPublishObservables).pipe(
                    switchMap(() =>
                      this.publishQuiz(createResult!.data!.createQuiz.id)
                    ),
                    catchError((optionError) => {
                      console.error(
                        'Some options failed to publish, but continuing with quiz publish',
                        optionError
                      );
                      return this.publishQuiz(
                        createResult!.data!.createQuiz.id
                      );
                    })
                  )
                : this.publishQuiz(createResult!.data!.createQuiz.id);
            })
          );
      })
    );
  }

  // Helper method to publish the quiz
  private publishQuiz(quizId: string): Observable<Quiz> {
    const PUBLISH_QUIZ = gql`
      mutation PublishQuiz($id: ID!) {
        publishQuiz(where: { id: $id }) {
          id
        }
      }
    `;

    return this.apollo
      .mutate<{ publishQuiz: { id: string } }>({
        mutation: PUBLISH_QUIZ,
        variables: { id: quizId },
      })
      .pipe(
        map(() => ({ id: quizId } as Quiz)), // Return minimal quiz data
        catchError((error) => {
          console.error(`Failed to publish quiz ${quizId}:`, error);
          throw error;
        })
      );
  }
}
