import { Routes } from '@angular/router';
import { WordLearningComponent } from './components/word-learning/word-learning.component';
import { LearningModeComponent } from './components/learning-mode/learning-mode.component';
import { WordReviewComponent } from './components/word-review/word-review.component';
import { ReviewModeComponent } from './components/review-mode/review-mode.component';
import { CreateWordComponent } from './components/create-word/create-word.component';
import { QuizTestComponent } from './components/quiz-test/quiz-test.component';
import { CreateQuizComponent } from './components/create-quiz/create-quiz.component';
import { QuizReviewComponent } from './components/quiz-review/quiz-review.component';

export const routes: Routes = [
  { path: '', redirectTo: '/word-learning', pathMatch: 'full' },
  { path: 'word-learning', component: WordLearningComponent },
  { path: 'word-learning/:id', component: LearningModeComponent },
  { path: 'word-review', component: WordReviewComponent },
  { path: 'word-review/:id', component: ReviewModeComponent },
  { path: 'word-create', component: CreateWordComponent },
  { path: 'quiz-learning', component: QuizTestComponent },
  { path: 'quiz-review', component: QuizReviewComponent },
  { path: 'quiz-create', component: CreateQuizComponent },
];
