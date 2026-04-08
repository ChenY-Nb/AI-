import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

type PlanRequest = {
  habit: "sleep_early" | "walking" | "less_sitting";
  sleepTime: string;
  availableTime: string;
  failureReason: "forgot" | "no_time" | "too_tired" | "no_motivation";
  wantsReminder: "yes" | "no";
};

function getHabitText(habit: PlanRequest["habit"]) {
  switch (habit) {
    case "sleep_early":
      return "早睡";
    case "walking":
      return "散步";
    case "less_sitting":
      return "减少久坐";
    default:
      return "健康习惯";
  }
}

function getFailureReasonText(reason: PlanRequest["failureReason"]) {
  switch (reason) {
    case "forgot":
      return "忘了";
    case "no_time":
      return "没时间";
    case "too_tired":
      return "太累了";
    case "no_motivation":
      return "不想做";
    default:
      return "不确定";
  }
}

function getReminderText(wantsReminder: PlanRequest["wantsReminder"]) {
  return wantsReminder === "yes" ? "愿意" : "暂时不需要";
}

function safeJsonParse(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    if (!process.env.DASHSCOPE_API_KEY) {
      return NextResponse.json(
        {
          error: "服务端缺少 DASHSCOPE_API_KEY，请检查 .env.local",
        },
        { status: 500 }
      );
    }

    const body: PlanRequest = await req.json();

    const habitText = getHabitText(body.habit);
    const failureReasonText = getFailureReasonText(body.failureReason);
    const reminderText = getReminderText(body.wantsReminder);

    const prompt = `
请根据下面用户信息，生成一个“7天健康习惯计划”。

要求：
1. 只能给低风险的生活习惯建议
2. 不要做疾病诊断
3. 不要给药物建议
4. 计划必须很小、很具体、能执行
5. 输出必须是 JSON
6. 不要输出 Markdown，不要输出解释，不要输出代码块
7. 只输出这 3 个字段：
{
  "mainGoal": "主目标",
  "supportAction": "辅助动作",
  "backupAction": "失败时改成"
}

用户信息：
- 想改善的习惯：${habitText}
- 平时睡觉时间：${body.sleepTime}
- 最方便执行的时间：${body.availableTime}
- 最常失败的原因：${failureReasonText}
- 是否愿意接收提醒：${reminderText}
`.trim();

    const completion = await client.chat.completions.create({
      model: "qwen-plus",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你是一个健康习惯教练。你只能提供低风险、可执行的健康习惯建议。禁止疾病诊断、药物建议、医疗建议。你必须严格输出 JSON。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || "";

    console.log("模型原始返回:", content);

    if (!content) {
      return NextResponse.json(
        {
          error: "模型没有返回内容",
        },
        { status: 500 }
      );
    }

    const parsed = safeJsonParse(content);

    if (
      typeof parsed.mainGoal !== "string" ||
      typeof parsed.supportAction !== "string" ||
      typeof parsed.backupAction !== "string"
    ) {
      return NextResponse.json(
        {
          error: "模型返回格式不完整",
          raw: content,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mainGoal: parsed.mainGoal,
      supportAction: parsed.supportAction,
      backupAction: parsed.backupAction,
    });
  } catch (error: any) {
    console.error("生成计划失败，完整错误:", error);
    console.error("error.message:", error?.message);
    console.error("error.stack:", error?.stack);

    return NextResponse.json(
      {
        error: "生成计划失败",
        detail: error?.message || "未知错误",
      },
      { status: 500 }
    );
  }
}