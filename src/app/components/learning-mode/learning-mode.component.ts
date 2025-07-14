import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { HotToastService } from '@ngneat/hot-toast';
import { GraphqlService } from '../../services/graphql.service';

@Component({
  selector: 'app-learning-mode',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './learning-mode.component.html',
  styleUrls: ['./learning-mode.component.css'],
})
export class LearningModeComponent implements OnInit {
  tagId: string = '';
  words: any[] = [];
  currentIndex = 0;
  showAnswer = false;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private graphqlService: GraphqlService,
    private toast: HotToastService
  ) {}

  ngOnInit(): void {
    this.tagId = this.route.snapshot.paramMap.get('id') || '';
    this.loadWords();
  }

  loadWords(): void {
    this.graphqlService.getWordItemsByTag(this.tagId).subscribe({
      next: (words) => {
        this.words = words;
        console.log('Loaded words:', this.words);
        this.isLoading = false;
        if (words.length === 0) {
          this.toast.info('No words found in this tag');
          this.router.navigate(['/learning']);
        }
      },
      error: (err) => {
        this.toast.error('Failed to load words');
        this.router.navigate(['/learning']);
      },
    });
  }

  get currentWord() {
    return this.words[this.currentIndex];
  }

  showMeaning(): void {
    this.showAnswer = true;
  }

  nextWord(know: boolean): void {
    if (know) {
      // 可以在这里添加标记单词为"已知道"的逻辑
    }

    this.showAnswer = false;

    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
    } else {
      this.finishLearning();
    }
  }

  finishLearning(): void {
    this.router.navigate(['/learning']);
  }
}
