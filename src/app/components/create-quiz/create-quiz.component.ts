import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GraphqlService } from '../../services/graphql.service';
import { CommonModule } from '@angular/common';
import { Category, QuizInput } from '../../../types/quiz.types';
import { catchError, of, forkJoin } from 'rxjs';

@Component({
  selector: 'app-create-quiz',
  templateUrl: './create-quiz.component.html',
  styleUrls: ['./create-quiz.component.css'],
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
})
export class CreateQuizComponent {
  quizForm: FormGroup;
  existingCategories: Category[] = [];
  filteredCategories: Category[] = [];
  showCategoryDropdown = false;
  selectedFiles: File[] = [];
  previewUrls: string[] = [];
  isLoading = false;
  newCategoryName = '';

  constructor(
    private fb: FormBuilder,
    private graphqlService: GraphqlService,
    private toast: ToastrService,
    private router: Router
  ) {
    this.quizForm = this.fb.group({
      quizContent: ['', Validators.required],
      correctAnswer: ['', Validators.required],
      isCollected: [false],
      quizImages: [[]],
      categories: this.fb.array([this.createCategoryField()]),
      quizOptions: this.fb.array([this.createQuizOption()]),
      categorySearch: [''],
    });
  }

  ngOnInit(): void {
    this.loadExistingCategories();
    this.quizForm.get('categorySearch')?.valueChanges.subscribe((value) => {
      this.filterCategories(value);
    });
  }

  createCategoryField(category?: Category): FormGroup {
    return this.fb.group({
      name: [category?.categoryName || '', Validators.required],
      isExisting: [!!category],
      tagId: [category?.id || null],
    });
  }

  loadExistingCategories(): void {
    this.graphqlService.getCategories().subscribe({
      next: (categories) => {
        this.existingCategories = categories;
        this.filteredCategories = [...categories];
      },
      error: (err) => {
        this.toast.error('Failed to load categories');
      },
    });
  }

  filterCategories(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredCategories = [...this.existingCategories];
      return;
    }
    this.filteredCategories = this.existingCategories.filter((category) =>
      category.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  createQuizOption(): FormGroup {
    return this.fb.group({
      quizOptionText: ['', Validators.required],
      optionImage: [null],
    });
  }

  get quizOptions(): FormArray {
    return this.quizForm.get('quizOptions') as FormArray;
  }

  addQuizOption(): void {
    this.quizOptions.push(this.createQuizOption());
  }

  removeQuizOption(index: number): void {
    if (this.quizOptions.length > 1) {
      this.quizOptions.removeAt(index);
    }
  }

  toggleCategoryDropdown(): void {
    this.showCategoryDropdown = !this.showCategoryDropdown;
    if (this.showCategoryDropdown) {
      this.filterCategories('');
    }
  }

  addNewCategory(): void {
    if (this.newCategoryName.trim()) {
      const newCategories = this.quizForm.get(
        'categories.newCategories'
      ) as FormArray;
      newCategories.push(this.fb.control(this.newCategoryName.trim()));
      this.newCategoryName = '';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        this.selectedFiles.push(file);

        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.previewUrls.push(e.target.result);
        };
        reader.readAsDataURL(file);
      }
      input.value = '';
    }
  }

  removeImage(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.previewUrls.splice(index, 1);
  }

  onOptionImageChange(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.quizOptions.at(index).get('optionImage')?.setValue(input.files[0]);
    }
  }

  onSubmit(): void {
    if (this.quizForm.invalid) {
      this.quizForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.quizForm.value;

    const quizData: QuizInput = {
      quizContent: formValue.quizContent,
      correctAnswer: formValue.correctAnswer,
      isCollected: formValue.isCollected,
      quizImages: this.selectedFiles,
      quizOptions: formValue.quizOptions.map((option: any) => ({
        quizOptionText: option.quizOptionText,
        optionImage: option.optionImage,
      })),
      categories: formValue.categories.map((cat: any) => ({
        name: cat.name,
        isExisting: cat.isExisting,
        categoryId: cat.categoryId || undefined,
      })),
    };

    this.graphqlService.createQuiz(quizData).subscribe({
      next: (quiz) => {
        this.toast.success('Quiz created successfully!');

        // Set loading to false for the main creation process

        // Set a new loading state for the publishing process

        setTimeout(() => {
          if (!quiz.quizOptions || quiz.quizOptions.length === 0) {
            return;
          }

          const publishOperations = quiz.quizOptions.map((option) =>
            this.graphqlService.publishQuizOption(option.id).pipe(
              catchError((error) => {
                console.error(`Failed to publish option ${option.id}:`, error);
                return of(null);
              })
            )
          );

          forkJoin(publishOperations).subscribe({
            next: () => {
              this.toast.success('All quiz options published successfully!');
              this.isLoading = false;
              this.resetForm();
            },
            error: (error) => {
              this.toast.error(
                `Some options failed to publish: ${error.message}`
              );
            },
          });
        }, 1000); // 10 second delay
      },
      error: (error) => {
        this.toast.error(`Error creating quiz: ${error.message}`);
        this.isLoading = false;
      },
    });
  }

  private resetForm(): void {
    this.quizForm.reset({
      isCollected: false,
    });
    this.clearFormArrays();
    this.addDefaultFields();
    this.selectedFiles = [];
    this.previewUrls = [];
  }

  private clearFormArrays(): void {
    while (this.quizOptions.length !== 0) this.quizOptions.removeAt(0);
  }

  private addDefaultFields(): void {
    this.quizOptions.push(this.createQuizOption());
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  // Add to CreateQuizComponent class

  addCategory(category?: Category): void {
    const categoryGroup = this.createCategoryField(category);
    this.categories.push(categoryGroup);
    this.showCategoryDropdown = false;
    this.quizForm.get('categorySearch')?.setValue('');
  }

  removeExistingCategory(id: string): void {
    const existingCategories = this.quizForm.get(
      'categories.existingCategories'
    ) as FormArray;
    const index = existingCategories.value.indexOf(id);
    if (index > -1) {
      existingCategories.removeAt(index);
    }
  }

  removeNewCategory(name: string): void {
    const newCategories = this.quizForm.get(
      'categories.newCategories'
    ) as FormArray;
    const index = newCategories.value.indexOf(name);
    if (index > -1) {
      newCategories.removeAt(index);
    }
  }
  get categories(): FormArray {
    return this.quizForm.get('categories') as FormArray;
  }

  removeCategory(index: number): void {
    if (this.categories.length > 1) {
      this.categories.removeAt(index);
    }
  }
}
