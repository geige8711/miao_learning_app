import { Component } from '@angular/core';
import { QuizLearningModeComponent } from '../quiz-learning-mode/quiz-learning-mode.component';
import { Category, CategoryWithQuizzes, Quiz } from '../../../types/quiz.types';
import { GraphqlService } from '../../services/graphql.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-review',
  imports: [QuizLearningModeComponent, CommonModule],
  templateUrl: './quiz-review.component.html',
  styleUrl: './quiz-review.component.css',
})
export class QuizReviewComponent {
  incorrectQuizzes: Quiz[] = [];
  currentQuizIndex = 0;
  selectedCategory: CategoryWithQuizzes | null = null;
  categories: CategoryWithQuizzes[] = [];

  constructor(private graphqlService: GraphqlService) {}

  ngOnInit() {
    this.graphqlService
      .getCategoriesWithIncorrectQuizzes()
      .subscribe((categories) => {
        this.categories = categories;
      });
  }

  startTest(category: CategoryWithQuizzes) {
    this.selectedCategory = category;
    this.incorrectQuizzes = this.selectedCategory.quiz;
    this.currentQuizIndex = 0;
    this.recordViewTime();
  }

  handleAnswer(isCorrect: boolean) {
    if (!isCorrect) {
      this.graphqlService
        .markQuizCollected(
          this.incorrectQuizzes[this.currentQuizIndex].id,
          true
        )
        .subscribe();
    }
  }

  nextQuestion() {
    if (this.currentQuizIndex < this.incorrectQuizzes.length - 1) {
      this.currentQuizIndex++;
      this.recordViewTime();
    }
  }

  finishReview() {
    this.incorrectQuizzes = [];
    this.currentQuizIndex = 0;
  }

  recordViewTime() {
    const currentViewTime =
      this.incorrectQuizzes[this.currentQuizIndex].viewTime;
    this.graphqlService
      .updateQuizViewTime(
        this.incorrectQuizzes[this.currentQuizIndex].id,
        currentViewTime
      )
      .subscribe();
  }

  get currentQuiz(): Quiz | null {
    return this.incorrectQuizzes[this.currentQuizIndex] || null;
  }

  get isLastQuestion(): boolean {
    return this.currentQuizIndex === this.incorrectQuizzes.length - 1;
  }
}
