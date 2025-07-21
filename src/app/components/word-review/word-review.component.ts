import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GraphqlService } from '../../services/graphql.service';

@Component({
  selector: 'app-word-learning',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './word-review.component.html',
  styleUrls: ['./word-review.component.css'],
})
export class WordReviewComponent implements OnInit {
  tags: any[] = [];
  isLoading = true;

  constructor(
    private graphqlService: GraphqlService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.graphqlService.getCollectedTags().subscribe({
      next: (tags) => {
        this.tags = tags;
        this.isLoading = false;
      },
      error: (err) => {
        this.toast.error('Failed to load tags');
        this.isLoading = false;
      },
    });
  }
}
