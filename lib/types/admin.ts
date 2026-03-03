export interface AdminUser {
  id: string
  role: 'admin' | 'compliance' | 'pricing'
}