-- AI Setting Migration
-- Add AI workspace setting support for 0.26 version

-- No table changes needed as AI settings are stored in workspace_setting table
-- The workspace_setting table already exists and can handle JSON values

-- Insert default AI setting if it doesn't exist
INSERT OR IGNORE INTO workspace_setting (name, value, description) 
VALUES (
  'workspace/settings/AI',
  '{"enableAi":false,"baseUrl":"","apiKey":"","model":"","timeoutSeconds":15}',
  'AI configuration settings'
);