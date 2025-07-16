import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizReviewComponent } from './quiz-review.component';

describe('QuizReviewComponent', () => {
  let component: QuizReviewComponent;
  let fixture: ComponentFixture<QuizReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
