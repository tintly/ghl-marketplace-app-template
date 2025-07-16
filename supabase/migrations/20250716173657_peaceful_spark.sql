/*
  # Fix location_id ambiguity in trigger functions

  1. Changes
     - Update calculate_customer_cost_trigger function to use NEW.location_id instead of ambiguous location_id
     - Update update_usage_tracking_from_logs function to use NEW.location_id instead of ambiguous location_id
  
  2. Reason
     - Fixes "column reference location_id is ambiguous" error when inserting into ai_usage_logs table
*/

-- Fix calculate_customer_cost_trigger function
CREATE OR REPLACE FUNCTION public.calculate_customer_cost_trigger()
RETURNS TRIGGER AS $$
DECLARE
    plan_messages_included INTEGER;
    plan_overage_price NUMERIC(10,6);
    is_agency_plan BOOLEAN;
    custom_key_used BOOLEAN;
BEGIN
    -- Set default values
    NEW.platform_cost_estimate := NEW.cost_estimate;
    NEW.customer_cost_estimate := NEW.cost_estimate;
    NEW.customer_cost_calculated := TRUE;
    
    -- Check if using custom OpenAI key
    custom_key_used := NEW.openai_key_used IS NOT NULL;
    
    -- Check if this is an agency plan
    SELECT EXISTS (
        SELECT 1 FROM public.ghl_configurations
        WHERE ghl_account_id = NEW.location_id AND ghl_user_type = 'agency'
    ) INTO is_agency_plan;
    
    -- For agency plans or custom keys, set customer cost to 0
    IF is_agency_plan OR custom_key_used THEN
        NEW.customer_cost_estimate := 0;
        RETURN NEW;
    END IF;
    
    -- Get subscription plan details
    SELECT sp.messages_included, sp.overage_price
    INTO plan_messages_included, plan_overage_price
    FROM public.location_subscriptions ls
    JOIN public.subscription_plans sp ON ls.plan_id = sp.id
    WHERE ls.location_id = NEW.location_id
    AND ls.is_active = TRUE;
    
    -- If no subscription found, use default pricing
    IF plan_messages_included IS NULL THEN
        NEW.customer_cost_estimate := NEW.cost_estimate * 1.5; -- 50% markup
    ELSE
        -- Apply subscription plan pricing
        NEW.customer_cost_estimate := NEW.cost_estimate * 1.5; -- 50% markup
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix update_usage_tracking_from_logs function
CREATE OR REPLACE FUNCTION public.update_usage_tracking_from_logs()
RETURNS TRIGGER AS $$
DECLARE
    current_month TEXT;
    custom_key_used BOOLEAN;
BEGIN
    -- Skip if not successful
    IF NOT NEW.success THEN
        RETURN NEW;
    END IF;
    
    -- Format current month as YYYY-MM
    current_month := to_char(NEW.created_at, 'YYYY-MM');
    
    -- Check if using custom OpenAI key
    custom_key_used := NEW.openai_key_used IS NOT NULL;
    
    -- Update usage tracking
    INSERT INTO public.usage_tracking (
        location_id, 
        month_year, 
        messages_used, 
        tokens_used, 
        cost_estimate,
        custom_key_used
    )
    VALUES (
        NEW.location_id, 
        current_month, 
        1, 
        NEW.total_tokens, 
        NEW.customer_cost_estimate,
        custom_key_used
    )
    ON CONFLICT (location_id, month_year) 
    DO UPDATE SET
        messages_used = usage_tracking.messages_used + 1,
        tokens_used = usage_tracking.tokens_used + NEW.total_tokens,
        cost_estimate = usage_tracking.cost_estimate + NEW.customer_cost_estimate,
        custom_key_used = custom_key_used OR usage_tracking.custom_key_used;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;