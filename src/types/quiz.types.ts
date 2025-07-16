export interface QuizOption {
  id: string;
  quizOptionText: string;
  optionImage?: {
    url: string;
  };
}

export interface Category {
  id: string;
  categoryName: string;
}

export interface CategoryWithQuizzes {
  id: string;
  categoryName: string;
  quiz: Quiz[];
}

export interface Quiz {
  id: string;
  quizContent: string;
  correctAnswer: string;
  quizOptions?: QuizOption[]; // Made optional
  isCollected: boolean;
  viewTime: Date[];
  category?: Category[]; // Made optional
  quizImages?: {
    url: string;
  }[]; // Optional images for the quiz
}

export interface QuizCreateInput {
  quizContent: string;
  correctAnswer: string;
  quizOptions: string[]; // Array of QuizOption IDs
  category: string[]; // Array of Category IDs
  isCollected?: boolean;
}

export interface QuizOptionInput {
  quizOptionText: string;
  optionImage?: string; // Asset ID
}

export interface QuizWithOptions extends Omit<Quiz, 'quizOptions'> {
  quizOptions: QuizOption[]; // Now guaranteed to exist
}
