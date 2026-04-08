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

type Habit = "sleep_early" | "walking" | "less_sitting";
type FailureReason = "forgot" | "no_time" | "too_tired" | "no_motivation";
type ReminderChoice = "yes" | "no";
type CheckinStatus = "done" | "partial" | "missed";

type SaveCheckinBody = {
  form: {
    habit: Habit;
    sleepTime: string;
    availableTime: string;
    failureReason: FailureReason;
    wantsReminder: ReminderChoice;
  };
  plan: {
    mainGoal: string;
    supportAction: string;
    backupAction: string;
  };
  checkin: {
    status: CheckinStatus;
    reason: "" | FailureReason;
    note: string;
  };
};

function detectRisk(text: string) {
  const content = text.trim().toLowerCase();

  if (!content) return null;

  const selfHarmKeywords = ["不想活", "想死", "自杀", "自残", "活着没意思"];
  const diagnosisKeywords = [
    "是不是糖尿病",
    "是不是抑郁",
    "是不是焦虑症",
    "是不是高血压",
    "是不是有病",
  ];
  const medicationKeywords = [
    "这个药怎么吃",
    "吃多少",
    "剂量",
    "药物",
    "一起吃",
    "处方",
  ];
  const acuteKeywords = [
    "胸痛",
    "呼吸困难",
    "喘不上气",
    "昏倒",
    "晕倒",
    "高烧",
  ];

  if (selfHarmKeywords.some((k) => content.includes(k))) {
    return {
      riskLevel: "high",
      riskType: "self_harm",
      actionText:
        "你提到的内容已经超出普通健康习惯建议范围。请立刻联系当地紧急求助资源，或马上联系你身边可信任的人陪着你，不要一个人扛。",
    };
  }

  if (acuteKeywords.some((k) => content.includes(k))) {
    return {
      riskLevel: "high",
      riskType: "acute_symptom",
      actionText:
        "你提到的情况可能存在紧急健康风险。我不能替代医生判断。请尽快联系急救、前往急诊，或立刻寻求线下专业帮助。",
    };
  }

  if (medicationKeywords.some((k) => content.includes(k))) {
    return {
      riskLevel: "medium",
      riskType: "medication",
      actionText:
        "我不能提供药物剂量或用药建议。这类问题需要由医生或药师判断，请尽快咨询线下专业人士。",
    };
  }

  if (diagnosisKeywords.some((k) => content.includes(k))) {
    return {
      riskLevel: "medium",
      riskType: "diagnosis",
      actionText:
        "我不能判断你是否患有某种疾病，也不能替代医生做诊断。建议尽快咨询线下医疗机构或专业人士。",
    };
  }

  return null;
}

function getTomorrowAdjustment(params: {
  habit: Habit;
  checkinStatus: CheckinStatus;
  checkinReason: "" | FailureReason;
  currentPlan: {
    mainGoal: string;
    supportAction: string;
    backupAction: string;
  };
}) {
  const { habit, checkinStatus, checkinReason, currentPlan } = params;

  if (checkinStatus === "done") {
    return {
      tomorrowMainGoal: currentPlan.mainGoal,
      tomorrowSupportAction: currentPlan.supportAction,
      adjustReason: "今天完成了，明天维持当前计划。",
    };
  }

  if (checkinStatus === "partial") {
    return {
      tomorrowMainGoal:
        habit === "sleep_early"
          ? "00:00 前上床，7 天完成 4 天"
          : habit === "walking"
          ? "散步 5 分钟，7 天完成 4 天"
          : "每坐 90 分钟起身活动 1 分钟，7 天完成 4 天",
      tomorrowSupportAction:
        habit === "sleep_early"
          ? "睡前拉伸 3 分钟"
          : habit === "walking"
          ? "如果太忙，改成原地走 3 分钟"
          : "下午固定站起来接水一次",
      adjustReason: "今天只部分完成，所以明天把目标缩小一点，提高完成率。",
    };
  }

  if (checkinStatus === "missed") {
    if (checkinReason === "forgot") {
      return {
        tomorrowMainGoal: currentPlan.mainGoal,
        tomorrowSupportAction:
          "把提醒提前 30 分钟，并在方便执行的时间前再提醒一次",
        adjustReason: "今天没做主要是忘了，所以先改提醒方式，不急着改目标。",
      };
    }

    if (checkinReason === "no_time") {
      return {
        tomorrowMainGoal:
          habit === "sleep_early"
            ? "00:15 前上床，7 天完成 4 天"
            : habit === "walking"
            ? "散步 5 分钟，7 天完成 4 天"
            : "每坐 120 分钟起身活动 1 分钟，7 天完成 4 天",
        tomorrowSupportAction:
          habit === "sleep_early"
            ? "睡前只做 1 分钟放松呼吸"
            : habit === "walking"
            ? "如果没时间外出，就室内拉伸 3 分钟"
            : "至少起身接水一次",
        adjustReason: "今天没时间，所以明天降低动作成本。",
      };
    }

    if (checkinReason === "too_tired") {
      return {
        tomorrowMainGoal:
          habit === "sleep_early"
            ? "00:15 前上床，7 天完成 4 天"
            : habit === "walking"
            ? "慢走 3 分钟，7 天完成 4 天"
            : "每坐 120 分钟站起来活动 1 分钟，7 天完成 4 天",
        tomorrowSupportAction:
          habit === "sleep_early"
            ? "睡前拉伸 3 分钟"
            : habit === "walking"
            ? "如果还是累，就原地活动 2 分钟"
            : "下午做 1 次肩颈拉伸 2 分钟",
        adjustReason: "今天太累了，所以明天先降低强度，恢复执行感。",
      };
    }

    if (checkinReason === "no_motivation") {
      return {
        tomorrowMainGoal:
          habit === "sleep_early"
            ? "00:15 前上床 1 次就算完成"
            : habit === "walking"
            ? "只走 2 分钟也算完成"
            : "只起身一次也算完成",
        tomorrowSupportAction: "先把动作做得小到不需要意志力。",
        adjustReason: "今天不想做，所以明天先把门槛降到最低。",
      };
    }
  }

  return {
    tomorrowMainGoal: currentPlan.mainGoal,
    tomorrowSupportAction: currentPlan.backupAction,
    adjustReason: "未命中特殊规则，先维持当前计划并使用更轻量备选动作。",
  };
}

export async function POST(req: Request) {
  let stage = "start";

  try {
    console.log("[save-checkin] SUPABASE_URL =", supabaseUrl);
    console.log(
      "[save-checkin] SUPABASE_SERVICE_ROLE_KEY exists =",
      !!supabaseServiceRoleKey
    );
    console.log(
      "[save-checkin] SUPABASE_SERVICE_ROLE_KEY prefix =",
      supabaseServiceRoleKey?.slice(0, 12)
    );

    stage = "parse_body";
    const body: SaveCheckinBody = await req.json();
    const { form, plan, checkin } = body;

    stage = "connectivity_test";
    const { error: connectivityError } = await supabase
      .from("checkins")
      .select("id")
      .limit(1);

    if (connectivityError) {
      console.error("[save-checkin] connectivityError =", connectivityError);
      throw connectivityError;
    }

    stage = "risk_detection";
    const risk = detectRisk(checkin.note);

    if (risk) {
      stage = "risk_insert";
      const { error: riskError } = await supabase.from("risk_events").insert({
        source: "checkin_note",
        risk_level: risk.riskLevel,
        risk_type: risk.riskType,
        trigger_text: checkin.note,
        action_text: risk.actionText,
      });

      if (riskError) {
        throw riskError;
      }

      return NextResponse.json({
        ok: true,
        type: "risk",
        stage,
        submitted: false,
        saveMessage: "已记录风险事件，已停止普通建议流程",
        riskTriggered: true,
        riskMessage: risk.actionText,
        tomorrowAdjustment: null,
      });
    }

    stage = "build_adjustment";
    const adjustment = getTomorrowAdjustment({
      habit: form.habit,
      checkinStatus: checkin.status,
      checkinReason: checkin.reason,
      currentPlan: plan,
    });

    stage = "checkin_insert";
    const { error: checkinError } = await supabase.from("checkins").insert({
      habit: form.habit,
      sleep_time: form.sleepTime,
      available_time: form.availableTime,
      failure_reason: form.failureReason,
      wants_reminder: form.wantsReminder,
      plan_main_goal: plan.mainGoal,
      plan_support_action: plan.supportAction,
      plan_backup_action: plan.backupAction,
      checkin_status: checkin.status,
      checkin_reason: checkin.reason || null,
      note: checkin.note || null,
    });

    if (checkinError) {
      throw checkinError;
    }

    stage = "adjustment_insert";
    const { error: adjustmentError } = await supabase.from("adjustments").insert({
      habit: form.habit,
      checkin_status: checkin.status,
      checkin_reason: checkin.reason || null,
      today_main_goal: plan.mainGoal,
      tomorrow_main_goal: adjustment.tomorrowMainGoal,
      tomorrow_support_action: adjustment.tomorrowSupportAction,
      adjust_reason: adjustment.adjustReason,
    });

    if (adjustmentError) {
      throw adjustmentError;
    }

    return NextResponse.json({
      ok: true,
      type: "normal",
      stage,
      submitted: true,
      saveMessage: "打卡和明日建议都已保存到 Supabase",
      riskTriggered: false,
      riskMessage: "",
      tomorrowAdjustment: adjustment,
    });
  } catch (error: any) {
    console.error("[save-checkin] stage =", stage);
    console.error("[save-checkin] error =", error);
    console.error("[save-checkin] error.message =", error?.message);
    console.error("[save-checkin] error.details =", error?.details);
    console.error("[save-checkin] error.hint =", error?.hint);
    console.error("[save-checkin] error.code =", error?.code);
    console.error("[save-checkin] error.cause =", error?.cause);
    console.error("[save-checkin] error.stack =", error?.stack);

    return NextResponse.json(
      {
        ok: false,
        stage,
        error: error?.message || "保存失败",
        details: error?.details || "",
        hint: error?.hint || "",
        code: error?.code || "",
        cause: error?.cause ? String(error.cause) : "",
      },
      { status: 500 }
    );
  }
}