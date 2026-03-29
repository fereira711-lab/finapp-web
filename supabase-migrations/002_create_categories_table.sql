-- Tabela de categorias personalizadas
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  icon TEXT DEFAULT '📦',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_categories" ON categories
  FOR ALL USING (auth.uid() = user_id);

-- Função para inserir categorias padrão ao criar perfil
CREATE OR REPLACE FUNCTION insert_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, color, icon) VALUES
    (NEW.id, 'alimentacao', '#F59E0B', '🍽️'),
    (NEW.id, 'transporte', '#3B82F6', '🚗'),
    (NEW.id, 'moradia', '#8B5CF6', '🏠'),
    (NEW.id, 'saude', '#EF4444', '❤️'),
    (NEW.id, 'educacao', '#06B6D4', '🎓'),
    (NEW.id, 'lazer', '#EC4899', '🎮'),
    (NEW.id, 'salario', '#10B981', '💰'),
    (NEW.id, 'investimento', '#6366F1', '📈'),
    (NEW.id, 'outros', '#94A3B8', '📦');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: ao criar perfil, cria categorias padrão
CREATE TRIGGER on_profile_created_insert_categories
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION insert_default_categories();
