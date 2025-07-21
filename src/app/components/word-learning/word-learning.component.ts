import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GraphqlService } from '../../services/graphql.service';

@Component({
  selector: 'app-word-learning',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './word-learning.component.html',
  styleUrls: ['./word-learning.component.css'],
})
export class WordLearningComponent implements OnInit {
  tags: any[] = [];
  isLoading = true;

  constructor(
    private graphqlService: GraphqlService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.graphqlService.getTags().subscribe({
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
