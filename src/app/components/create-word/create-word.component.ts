import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';

import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { GraphqlService } from '../../services/graphql.service';
import { Tag } from '../../../types/word.types';

@Component({
  selector: 'app-create-word',
  templateUrl: './create-word.component.html',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
})
export class CreateWordComponent {
  wordItemForm: FormGroup;
  existingTags: Tag[] = [];
  filteredTags: Tag[] = [];
  showTagDropdown = false;
  selectedFiles: File[] = [];
  previewUrls: string[] = [];
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private graphqlService: GraphqlService,
    private toast: ToastrService,
    private router: Router
  ) {
    this.wordItemForm = this.fb.group({
      item: ['', Validators.required],
      meaning: ['', Validators.required],
      isKnown: [false],
      isCollected: [false],
      tags: this.fb.array([this.createTagField()]),
      examples: this.fb.array([]),
      tagSearch: [''],
    });
  }

  ngOnInit(): void {
    this.loadExistingTags();
    this.wordItemForm.get('tagSearch')?.valueChanges.subscribe((value) => {
      this.filterTags(value);
    });
  }

  loadExistingTags(): void {
    this.graphqlService.getTags().subscribe({
      next: (tags) => {
        this.existingTags = tags;
        this.filteredTags = [...tags];
      },
      error: (err) => {
        this.toast.error('Failed to load tags');
      },
    });
  }

  filterTags(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredTags = [...this.existingTags];
      return;
    }
    this.filteredTags = this.existingTags.filter((tag) =>
      tag.tagName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  createTagField(tag?: Tag): FormGroup {
    return this.fb.group({
      name: [tag?.tagName || '', Validators.required],
      isExisting: [!!tag],
      tagId: [tag?.id || null],
    });
  }

  createExampleField(): FormGroup {
    return this.fb.group({
      sentence: [''],
      meaning: [''],
    });
  }

  get tags(): FormArray {
    return this.wordItemForm.get('tags') as FormArray;
  }

  get examples(): FormArray {
    return this.wordItemForm.get('examples') as FormArray;
  }

  addTag(tag?: Tag): void {
    const tagGroup = this.createTagField(tag);
    this.tags.push(tagGroup);
    this.showTagDropdown = false;
    this.wordItemForm.get('tagSearch')?.setValue('');
  }

  removeTag(index: number): void {
    if (this.tags.length > 1) {
      this.tags.removeAt(index);
    }
  }

  addExample(): void {
    this.examples.push(this.createExampleField());
  }

  removeExample(index: number): void {
    this.examples.removeAt(index);
  }

  toggleTagDropdown(): void {
    this.showTagDropdown = !this.showTagDropdown;
    if (this.showTagDropdown) {
      this.filterTags('');
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
      input.value = ''; // 重置input以便可以重复选择相同文件
    }
  }

  removeImage(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.previewUrls.splice(index, 1);
  }

  onSubmit(): void {
    if (this.wordItemForm.invalid) {
      this.wordItemForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.wordItemForm.value;

    const wordItemData = {
      item: formValue.item,
      meaning: formValue.meaning,
      isKnown: formValue.isKnown,
      isCollected: formValue.isCollected,
      examples: formValue.examples
        .filter((ex: any) => ex.sentence && ex.sentence.trim() !== '')
        .map((ex: any) => ({
          sentence: ex.sentence,
          meaning: ex.meaning || undefined,
        })),
      tags: formValue.tags.map((tag: any) => ({
        name: tag.name,
        isExisting: tag.isExisting,
        tagId: tag.tagId || undefined,
      })),
      images: this.selectedFiles,
    };

    this.graphqlService.createWordItem(wordItemData).subscribe({
      next: (wordItem) => {
        this.toast.success('Word item created successfully!');
        this.resetForm();
        this.isLoading = false;
      },
      error: (error) => {
        this.toast.error(`Error creating word item: ${error.message}`);
        this.isLoading = false;
      },
    });
  }

  private resetForm(): void {
    this.wordItemForm.reset({
      isKnown: false,
      isCollected: false,
    });
    this.clearFormArrays();
    this.addDefaultFields();
    this.selectedFiles = [];
    this.previewUrls = [];
  }

  private clearFormArrays(): void {
    while (this.tags.length !== 0) this.tags.removeAt(0);
    while (this.examples.length !== 0) this.examples.removeAt(0);
  }

  private addDefaultFields(): void {
    this.tags.push(this.createTagField());
    // Don't add default example field - examples are now optional
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
