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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
