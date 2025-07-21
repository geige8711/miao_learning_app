import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { ToastrService } from 'ngx-toastr';
import { GraphqlService } from '../../services/graphql.service';

@Component({
  selector: 'app-learning-mode',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './review-mode.component.html',
  styleUrls: ['./review-mode.component.css'],
})
export class ReviewModeComponent implements OnInit {
  tagId: string = '';
  words: any[] = [];
  currentIndex = 0;
  showAnswer = false;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private graphqlService: GraphqlService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.tagId = this.route.snapshot.paramMap.get('id') || '';
    this.loadWords();
  }

  loadWords(): void {
    this.graphqlService.getCollectedWordItemsByTag(this.tagId).subscribe({
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

  recordViewTime() {
    const currentViewTime = this.words[this.currentIndex].viewTime;
    currentViewTime.push(new Date().toISOString());
    this.graphqlService
      .updateWordViewTimestamp(
        this.words[this.currentIndex].id,
        currentViewTime
      )
      .subscribe();
  }

  get currentWord() {
    return this.words[this.currentIndex];
  }

  showMeaning(): void {
    this.showAnswer = true;
  }

  nextWord(know: boolean): void {
    this.recordViewTime();
    this.graphqlService
      .markWordItemCollected(this.currentWord.id, know)
      .subscribe({
        next: () => {
          this.toast.success(`Word marked as ${know ? 'known' : 'unknown'}`);
        },
        error: () => {
          this.toast.error(
            `Failed to mark word as ${know ? 'known' : 'unknown'}`
          );
        },
      });

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
