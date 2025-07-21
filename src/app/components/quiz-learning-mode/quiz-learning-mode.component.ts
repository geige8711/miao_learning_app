import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Quiz } from '../../../types/quiz.types';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-learning-mode',
  imports: [CommonModule],
  templateUrl: './quiz-learning-mode.component.html',
  styleUrl: './quiz-learning-mode.component.css',
})
export class QuizLearningModeComponent {
  @Input() quiz: Quiz | null = null;
  @Input() isLastQuestion: boolean = false;
  @Output() answerSubmitted = new EventEmitter<boolean>();
  @Output() nextQuestion = new EventEmitter<void>();
  @Output() finishTest = new EventEmitter<void>();

  selectedOption: number | null = null;
  submitted = false;
  isCorrect = false;

  selectOption(index: number): void {
    if (!this.submitted) {
      this.selectedOption = index;
    }
  }

  get quizContent(): string {
    return this.quiz
      ? this.quiz.quizContent.replace('answer_placeholder', '__________')
      : '';
  }

  convertAnswerToLetter(correctAnswer: string): number {
    switch (correctAnswer) {
      case 'A':
        return 0;
      case 'B':
        return 1;
      case 'C':
        return 2;
      case 'D':
        return 3;
      default:
        return 4;
    }
  }

  submitAnswer(): void {
    if (this.selectedOption === null) return;

    this.submitted = true;
    this.isCorrect =
      this.convertAnswerToLetter(this.quiz!.correctAnswer) ===
      this.selectedOption;
    this.answerSubmitted.emit(this.isCorrect);
  }

  moveToNext(): void {
    this.nextQuestion.emit();
    this.resetState();
  }

  endTest(): void {
    this.finishTest.emit();
    this.resetState();
  }

  private resetState(): void {
    this.selectedOption = null;
    this.submitted = false;
    this.isCorrect = false;
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
