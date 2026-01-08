export interface CheatItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string; // Markdown content
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  account_name?: string | null;
}

export type ViewState = 'login' | 'dashboard' | 'list' | 'detail' | 'create' | 'edit';

export enum CategoryType {
  CODE = 'Code',
  COMMAND = 'Command',
  RECIPE = 'Recipe',
  SHORTCUT = 'Shortcut',
  OTHER = 'Other'
}

export const CATEGORIES = Object.values(CategoryType);