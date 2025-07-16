import { Component } from '@angular/core';

import { forkJoin } from 'rxjs';
import { GraphqlService } from '../../services/graphql.service';
import { QuizOptionInput, QuizCreateInput } from '../../../types/quiz.types';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-create-quiz',
  templateUrl: './create-quiz.component.html',
  styleUrls: ['./create-quiz.component.css'],
  standalone: true,
  imports: [FormsModule],
})
export class CreateQuizComponent {
  quizData = {
    quizContent: '',
    correctAnswer: '',
    options: [] as QuizOptionInput[],
    categories: [] as string[],
  };
  categories: { id: string; name: string }[] = [];
  currentOptionText = '';
  showOptionForm = false;

  constructor(private graphqlService: GraphqlService) {}

  ngOnInit() {
    this.graphqlService.getCategories().subscribe((categories) => {
      this.categories = categories.map((c) => ({
        id: c.id,
        name: c.categoryName,
      }));
    });
  }

  addOption() {
    if (this.currentOptionText.trim()) {
      this.quizData.options.push({
        quizOptionText: this.currentOptionText.trim(),
        optionImage: undefined,
      });
      this.currentOptionText = '';
    }
  }

  removeOption(index: number) {
    this.quizData.options.splice(index, 1);
  }

  toggleCategory(categoryId: string) {
    const index = this.quizData.categories.indexOf(categoryId);
    if (index === -1) {
      this.quizData.categories.push(categoryId);
    } else {
      this.quizData.categories.splice(index, 1);
    }
  }

  createQuiz() {
    if (
      !this.quizData.quizContent ||
      !this.quizData.correctAnswer ||
      this.quizData.options.length < 2
    ) {
      alert('Please fill all required fields and add at least 2 options');
      return;
    }

    // First create all quiz options
    const optionCreation$ = this.quizData.options.map((option) =>
      this.graphqlService.createQuizOption(option)
    );

    forkJoin(optionCreation$).subscribe((createdOptions) => {
      const quizData: QuizCreateInput = {
        quizContent: this.quizData.quizContent,
        correctAnswer: this.quizData.correctAnswer,
        quizOptions: createdOptions.map((option) => option.id),
        category: this.quizData.categories,
      };

      this.graphqlService.createQuiz(quizData).subscribe({
        next: () => {
          alert('Quiz created successfully!');
          this.resetForm();
        },
        error: (err) => {
          console.error('Error creating quiz:', err);
          alert('Failed to create quiz');
        },
      });
    });
  }

  resetForm() {
    this.quizData = {
      quizContent: '',
      correctAnswer: '',
      options: [],
      categories: [],
    };
    this.currentOptionText = '';
  }
}
