import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuizLearningModeComponent } from './quiz-learning-mode.component';

describe('QuizLearningModeComponent', () => {
  let component: QuizLearningModeComponent;
  let fixture: ComponentFixture<QuizLearningModeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizLearningModeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuizLearningModeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
