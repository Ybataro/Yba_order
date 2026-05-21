-- ============================================================
-- Audit Log 基礎設施（2026-05-21）
--
-- 目的：對 leave_requests 與 daily_expenses 建立自動審計日誌
-- 設計：
--   1. 通用 audit_log 表（所有表共用）
--   2. 通用 trigger function（依 TG_TABLE_NAME 自動 dispatch）
--   3. actor_id 從 PostgreSQL session variable 'app.actor_id' 讀取
--      → application 端在每個 mutation 前必須先呼叫
--        await supabase.rpc('set_actor', { actor_id: session.staffId })
-- ============================================================

-- ── 1. 通用 audit_log 表 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,             -- 對應紀錄的 PK（uuid 或 text 都統一存 text）
  action      TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  actor_id    TEXT,                       -- 從 app.actor_id session var 讀取
  old_data    JSONB,                      -- UPDATE/DELETE 時的舊資料
  new_data    JSONB,                      -- INSERT/UPDATE 時的新資料
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON public.audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON public.audit_log (actor_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
  ON public.audit_log (changed_at DESC);

-- RLS：所有人可讀（admin UI 需要查），但只有 trigger 可寫
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_read_all ON public.audit_log;
CREATE POLICY audit_log_read_all ON public.audit_log FOR SELECT USING (true);
-- 注意：故意不開 INSERT/UPDATE/DELETE policy，application 不能直寫，只能透過 trigger

-- ── 2. 設定 actor_id 的 RPC function（application 呼叫）─────
CREATE OR REPLACE FUNCTION public.set_actor(actor_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.actor_id', COALESCE(actor_id, ''), false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_actor(TEXT) TO anon, authenticated;

-- ── 3. 通用 audit trigger function ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor TEXT;
  v_record_id TEXT;
BEGIN
  -- 從 session 取 actor_id（若 application 未設定則為空）
  BEGIN
    v_actor := current_setting('app.actor_id', true);
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  -- 取得 record_id（PK 欄位名為 id）
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::TEXT;
  ELSE
    v_record_id := NEW.id::TEXT;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    NULLIF(v_actor, ''),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ── 4. 套用到 leave_requests ──────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_leave_requests ON public.leave_requests;
CREATE TRIGGER trg_audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- ── 5. 套用到 daily_expenses ──────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_daily_expenses ON public.daily_expenses;
CREATE TRIGGER trg_audit_daily_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();
