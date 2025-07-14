import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { gql } from '@apollo/client/core';
import { forkJoin, Observable, of, from, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Tag, WordItem, CreateWordItemInput } from '../../types/word.types';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GraphqlService {
  private hygraphUrl = environment.hygraphUrl;
  private hygraphToken = environment.hygraphToken;

  constructor(private apollo: Apollo, private http: HttpClient) {}
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
    const GET_TAGS = gql`
      query GetTags {
        tags {
          id
          tagName
          createdAt
          updatedAt
          wordItem {
            id
            item
          }
        }
      }
    `;

    return this.apollo
      .query<{ tags: Tag[] }>({
        query: GET_TAGS,
      })
      .pipe(map((result) => result.data.tags));
  }

  // Get word items by tag
  getWordItemsByTag(tagId: string): Observable<WordItem[]> {
    const GET_WORD_ITEMS_BY_TAG = gql`
      query GetWordItemsByTag($tagId: ID!) {
        tag(where: { id: $tagId }) {
          wordItem {
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

    return this.apollo
      .query<{ tag: { wordItem: WordItem[] } }>({
        query: GET_WORD_ITEMS_BY_TAG,
        variables: { tagId },
      })
      .pipe(map((result) => result.data.tag.wordItem));
  }

  // Update word item view timestamp
  updateWordViewTimestamp(
    wordItemId: string,
    timestamp: string
  ): Observable<WordItem> {
    const UPDATE_WORD_VIEW_TIMESTAMP = gql`
      mutation UpdateWordViewTimestamp($id: ID!, $timestamp: String!) {
        updateWordItem(
          where: { id: $id }
          data: { viewTime: { push: $timestamp } }
        ) {
          id
          item
          viewTime
          updatedAt
        }
      }
    `;

    return this.apollo
      .mutate<{ updateWordItem: WordItem }>({
        mutation: UPDATE_WORD_VIEW_TIMESTAMP,
        variables: { id: wordItemId, timestamp },
      })
      .pipe(map((result) => result.data!.updateWordItem));
  }

  createWordItem(wordItemData: CreateWordItemInput): Observable<WordItem> {
    const uploadObservables =
      wordItemData.images?.map((file) =>
        this.createAndUploadAsset(file).pipe(
          catchError((error) => {
            console.error(`File ${file.name} upload failed:`, error);
            throw new Error(`File upload failed: ${file.name}`);
          })
        )
      ) || [];

    return forkJoin(uploadObservables).pipe(
      switchMap((uploadResults) => {
        // Prepare image connections outside the GQL template
        const imageConnections = uploadResults.map((res) => ({
          id: res.data.publishAsset.id,
        }));

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
            $examples: [ExampleCreateInput!]!
            $isKnown: Boolean
            $isCollected: Boolean
            $imageConnections: [AssetWhereUniqueInput!]!
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
      })
    );
  }

  // Mark word item as unknown
  markWordItemUnknown(
    wordItemId: string,
    isKnown: boolean
  ): Observable<WordItem> {
    const MARK_WORD_ITEM_UNKNOWN = gql`
      mutation MarkWordItemUnknown($id: ID!, $isKnown: Boolean!) {
        updateWordItem(where: { id: $id }, data: { isKnown: $isKnown }) {
          id
          item
          isKnown
          updatedAt
        }
      }
    `;

    return this.apollo
      .mutate<{ updateWordItem: WordItem }>({
        mutation: MARK_WORD_ITEM_UNKNOWN,
        variables: { id: wordItemId, isKnown },
      })
      .pipe(map((result) => result.data!.updateWordItem));
  }

  // Mark word item as collected
  markWordItemCollected(
    wordItemId: string,
    isCollected: boolean
  ): Observable<WordItem> {
    const MARK_WORD_ITEM_COLLECTED = gql`
      mutation MarkWordItemCollected($id: ID!, $isCollected: Boolean!) {
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

    return this.apollo
      .mutate<{ updateWordItem: WordItem }>({
        mutation: MARK_WORD_ITEM_COLLECTED,
        variables: { id: wordItemId, isCollected },
      })
      .pipe(map((result) => result.data!.updateWordItem));
  }
}
