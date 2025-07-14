import { Routes } from '@angular/router';
import { WordLearningComponent } from './components/word-learning/word-learning.component';
import { LearningModeComponent } from './components/learning-mode/learning-mode.component';
import { WordReviewComponent } from './components/word-review/word-review.component';
import { ReviewModeComponent } from './components/review-mode/review-mode.component';
import { CreateWordComponent } from './components/create-word/create-word.component';

export const routes: Routes = [
  { path: '', redirectTo: '/learning', pathMatch: 'full' },
  { path: 'learning', component: WordLearningComponent },
  { path: 'learning/:id', component: LearningModeComponent },
  { path: 'review', component: WordReviewComponent },
  { path: 'review/:id', component: ReviewModeComponent },
  { path: 'create', component: CreateWordComponent },
];
