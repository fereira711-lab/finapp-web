export interface Profile {
  id: string;
  name: string;
}

export interface Account {
  id: string;
  user_id: string;
  pluggy_account_id: string | null;
  bank_name: string;
  account_type: string;
  name: string;
  balance: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: "income" | "expense";
  status: string;
}

export interface Bill {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  due_date: string;
  type: "payable" | "receivable";
  status: "pending" | "paid" | "overdue";
  recurrent: boolean;
  recurrence_day: number | null;
  notes: string | null;
}

export interface CreditCard {
  id: string;
  user_id: string;
  name: string;
  bank_name: string;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  color: string;
  created_at: string;
}

export interface CardTransaction {
  id: string;
  user_id: string;
  card_id: string;
  description: string;
  amount: number;
  date: string;
  installments: number;
  installment_current: number;
  category: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
