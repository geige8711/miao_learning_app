import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WordReviewComponent } from './word-review.component';

describe('WordReviewComponent', () => {
  let component: WordReviewComponent;
  let fixture: ComponentFixture<WordReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordReviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WordReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
