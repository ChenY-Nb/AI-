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

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;

function getDate30DaysAgoISOString() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(parsed, MAX_HISTORY_LIMIT);
}

function sanitizeSearch(value: string | null) {
  return (value || "").replace(/,/g, " ").trim();
}

function applyCheckinSearch(query: any, q: string) {
  if (!q) return query;

  return query.or(
    [
      `habit.ilike.%${q}%`,
      `checkin_status.ilike.%${q}%`,
      `checkin_reason.ilike.%${q}%`,
      `plan_main_goal.ilike.%${q}%`,
      `note.ilike.%${q}%`,
    ].join(",")
  );
}

function applyAdjustmentSearch(query: any, q: string) {
  if (!q) return query;

  return query.or(
    [
      `habit.ilike.%${q}%`,
      `checkin_status.ilike.%${q}%`,
      `checkin_reason.ilike.%${q}%`,
      `today_main_goal.ilike.%${q}%`,
      `tomorrow_main_goal.ilike.%${q}%`,
      `tomorrow_support_action.ilike.%${q}%`,
      `adjust_reason.ilike.%${q}%`,
    ].join(",")
  );
}

function applyRiskSearch(query: any, q: string) {
  if (!q) return query;

  return query.or(
    [
      `source.ilike.%${q}%`,
      `risk_level.ilike.%${q}%`,
      `risk_type.ilike.%${q}%`,
      `trigger_text.ilike.%${q}%`,
      `action_text.ilike.%${q}%`,
    ].join(",")
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const type = url.searchParams.get("type") || "all";
    const status = url.searchParams.get("status") || "all";
    const riskLevel = url.searchParams.get("riskLevel") || "all";
    const q = sanitizeSearch(url.searchParams.get("q"));
    const limit = parseLimit(url.searchParams.get("limit"));

    const since = getDate30DaysAgoISOString();

    // 首页 overview：最近 30 天，不受历史筛选器影响
    const { data: overviewCheckins, error: overviewCheckinsError } =
      await supabase
        .from("checkins")
        .select(
          "id, created_at, habit, checkin_status, checkin_reason, plan_main_goal, note"
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false });

    if (overviewCheckinsError) {
      throw overviewCheckinsError;
    }

    const { data: overviewAdjustments, error: overviewAdjustmentsError } =
      await supabase
        .from("adjustments")
        .select(
          "id, created_at, habit, checkin_status, checkin_reason, today_main_goal, tomorrow_main_goal, tomorrow_support_action, adjust_reason"
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false });

    if (overviewAdjustmentsError) {
      throw overviewAdjustmentsError;
    }

    const { data: overviewRisks, error: overviewRisksError } = await supabase
      .from("risk_events")
      .select(
        "id, created_at, source, risk_level, risk_type, trigger_text, action_text"
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (overviewRisksError) {
      throw overviewRisksError;
    }

    // 历史页：服务端真实筛选
    let historyCheckins: any[] = [];
    let historyAdjustments: any[] = [];
    let historyRisks: any[] = [];

    if (type === "all" || type === "checkins") {
      let query = supabase
        .from("checkins")
        .select(
          "id, created_at, habit, checkin_status, checkin_reason, plan_main_goal, note"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        query = query.eq("checkin_status", status);
      }

      query = applyCheckinSearch(query, q);

      const { data, error } = await query;
      if (error) throw error;
      historyCheckins = data || [];
    }

    if (type === "all" || type === "adjustments") {
      let query = supabase
        .from("adjustments")
        .select(
          "id, created_at, habit, checkin_status, checkin_reason, today_main_goal, tomorrow_main_goal, tomorrow_support_action, adjust_reason"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        query = query.eq("checkin_status", status);
      }

      query = applyAdjustmentSearch(query, q);

      const { data, error } = await query;
      if (error) throw error;
      historyAdjustments = data || [];
    }

    if (type === "all" || type === "risks") {
      let query = supabase
        .from("risk_events")
        .select(
          "id, created_at, source, risk_level, risk_type, trigger_text, action_text"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (riskLevel !== "all") {
        query = query.eq("risk_level", riskLevel);
      }

      query = applyRiskSearch(query, q);

      const { data, error } = await query;
      if (error) throw error;
      historyRisks = data || [];
    }

    return NextResponse.json({
      ok: true,
      filters: {
        type,
        status,
        riskLevel,
        q,
        limit,
      },
      overview: {
        checkins: overviewCheckins || [],
        adjustments: overviewAdjustments || [],
        risks: overviewRisks || [],
      },
      history: {
        checkins: historyCheckins,
        adjustments: historyAdjustments,
        risks: historyRisks,
      },
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