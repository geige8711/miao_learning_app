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
  isCollected: boolean; // Made nullable
  viewTime: string[];
  category?: Category[]; // Made optional
  quizImages?: {
    url: string;
  }[]; // Optional images for the quiz
}

export interface QuizInput {
  quizContent: string;
  correctAnswer: string;
  quizOptions: QuizOptionInput[];
  quizImages?: File[];
  isCollected?: boolean;
  categories: CategoryInput[]; // Array of categories
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
  optionImage?: File; // Asset ID
}

export interface QuizWithOptions extends Omit<Quiz, 'quizOptions'> {
  quizOptions: QuizOption[]; // Now guaranteed to exist
}

export interface CategoryInput {
  name: string;
  isExisting: boolean;
  categoryId?: string;
}

export interface QuizOptionCreateInput {
  quizOptionText: string;
  optionImage?: {
    connect?: {
      id: string;
    };
  };
}
