import { Component } from '@angular/core';
import { Category, Quiz } from '../../../types/quiz.types';
import { GraphqlService } from '../../services/graphql.service';
import { QuizLearningModeComponent } from '../quiz-learning-mode/quiz-learning-mode.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-test',
  imports: [QuizLearningModeComponent, CommonModule],
  templateUrl: './quiz-test.component.html',
  styleUrl: './quiz-test.component.css',
})
export class QuizTestComponent {
  categories: Category[] = [];
  selectedCategory: Category | null = null;
  quizzes: Quiz[] = [];
  currentQuizIndex = 0;

  constructor(private graphqlService: GraphqlService) {}

  ngOnInit() {
    this.graphqlService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  startTest(category: Category) {
    this.selectedCategory = category;
    this.graphqlService
      .getQuizzesByCategory(category.id)
      .subscribe((quizzes) => {
        this.quizzes = quizzes;
        this.currentQuizIndex = 0;
        this.recordViewTime();
      });
  }

  handleAnswer(isCorrect: boolean) {
    this.graphqlService
      .markQuizCollected(this.quizzes[this.currentQuizIndex].id, !isCorrect)
      .subscribe();
  }

  nextQuestion() {
    if (this.currentQuizIndex < this.quizzes.length - 1) {
      this.currentQuizIndex++;
      this.recordViewTime();
    }
  }

  finishTest() {
    this.selectedCategory = null;
    this.quizzes = [];
    this.currentQuizIndex = 0;
  }

  recordViewTime() {
    const currentViewTime = this.quizzes[this.currentQuizIndex].viewTime;
    this.graphqlService
      .updateQuizViewTime(
        this.quizzes[this.currentQuizIndex].id,
        currentViewTime
      )
      .subscribe();
  }

  get currentQuiz(): Quiz | null {
    return this.quizzes[this.currentQuizIndex] || null;
  }

  get isLastQuestion(): boolean {
    return this.currentQuizIndex === this.quizzes.length - 1;
  }
}
