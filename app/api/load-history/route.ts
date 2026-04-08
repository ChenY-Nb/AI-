import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("缺少 SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET() {
  try {
    const { data: checkins, error: checkinsError } = await supabase
      .from("checkins")
      .select(
        "id, created_at, habit, checkin_status, checkin_reason, plan_main_goal, note"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (checkinsError) {
      throw checkinsError;
    }

    const { data: adjustments, error: adjustmentsError } = await supabase
      .from("adjustments")
      .select(
        "id, created_at, habit, checkin_status, checkin_reason, today_main_goal, tomorrow_main_goal, tomorrow_support_action, adjust_reason"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (adjustmentsError) {
      throw adjustmentsError;
    }

    const { data: risks, error: risksError } = await supabase
      .from("risk_events")
      .select(
        "id, created_at, source, risk_level, risk_type, trigger_text, action_text"
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (risksError) {
      throw risksError;
    }

    return NextResponse.json({
      ok: true,
      checkins: checkins || [],
      adjustments: adjustments || [],
      risks: risks || [],
    });
  } catch (error: any) {
    console.error("load-history route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "加载历史记录失败",
        details: error?.details || "",
        hint: error?.hint || "",
        code: error?.code || "",
      },
      { status: 500 }
    );
  }
}