import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WordLearningComponent } from './word-learning.component';

describe('WordLearningComponent', () => {
  let component: WordLearningComponent;
  let fixture: ComponentFixture<WordLearningComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordLearningComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WordLearningComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
