// types.ts
export interface Tag {
  id: string;
  tagName: string;
  createdAt: Date;
  updatedAt: Date;
  wordItem: WordItem[];
}

export interface Example {
  id: string;
  sentence: string;
  meaning: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface TagInput {
  name: string;
  isExisting: boolean;
  tagId?: string;
}

export interface ExampleInput {
  sentence: string;
  meaning?: string;
}

export interface WordItem {
  id: string;
  item: string;
  meaning: string;
  examples: Example[];
  tags: Tag[];
  isKnown: boolean;
  isCollected: boolean;
  images: Asset[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWordItemInput {
  item: string;
  meaning: string;
  examples: ExampleInput[];
  tags: TagInput[];
  isKnown?: boolean;
  isCollected?: boolean;
  images?: File[]; // 文件上传专用字段
}

export interface UpdateWordItemInput {
  isKnown?: boolean;
  isCollected?: boolean;
  viewTime?: string[];
}
