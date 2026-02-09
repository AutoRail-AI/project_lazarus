-- Add new browser testing event types to agent_events
ALTER TABLE agent_events DROP CONSTRAINT IF EXISTS agent_events_event_type_check;
ALTER TABLE agent_events ADD CONSTRAINT agent_events_event_type_check
  CHECK (event_type IN (
    'thought', 'tool_call', 'observation', 'code_write',
    'test_run', 'test_result', 'self_heal', 'confidence_update',
    'browser_action', 'screenshot', 'app_start'
  ));
