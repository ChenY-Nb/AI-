"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const habitOptions = [
  { label: "早睡", value: "sleep_early" },
  { label: "散步", value: "walking" },
  { label: "减少久坐", value: "less_sitting" },
] as const;

const failureReasons = [
  { label: "忘了", value: "forgot" },
  { label: "没时间", value: "no_time" },
  { label: "太累了", value: "too_tired" },
  { label: "不想做", value: "no_motivation" },
] as const;

const completionOptions = [
  { label: "做到了", value: "done" },
  { label: "部分做到", value: "partial" },
  { label: "没做到", value: "missed" },
] as const;

const pageTitles = ["欢迎页", "问卷页", "计划页", "打卡页", "历史记录页"];

type Habit = "sleep_early" | "walking" | "less_sitting";
type FailureReason = "forgot" | "no_time" | "too_tired" | "no_motivation";
type ReminderChoice = "yes" | "no";
type CheckinStatus = "done" | "partial" | "missed";

type FormState = {
  habit: Habit;
  sleepTime: string;
  availableTime: string;
  failureReason: FailureReason;
  wantsReminder: ReminderChoice;
};

type GeneratedPlan = {
  mainGoal: string;
  supportAction: string;
  backupAction: string;
};

type CheckinState = {
  status: CheckinStatus;
  reason: "" | FailureReason;
  note: string;
};

type TomorrowAdjustment = {
  tomorrowMainGoal: string;
  tomorrowSupportAction: string;
  adjustReason: string;
};

type HistoryCheckin = {
  id: number;
  created_at: string;
  habit: string;
  checkin_status: string;
  checkin_reason: string | null;
  plan_main_goal: string | null;
  note: string | null;
};

type HistoryAdjustment = {
  id: number;
  created_at: string;
  habit: string;
  checkin_status: string;
  checkin_reason: string | null;
  today_main_goal: string | null;
  tomorrow_main_goal: string;
  tomorrow_support_action: string;
  adjust_reason: string;
};

type HistoryRiskEvent = {
  id: number;
  created_at: string;
  source: string;
  risk_level: string;
  risk_type: string;
  trigger_text: string;
  action_text: string;
};

function StepBadge({
  index,
  current,
}: {
  index: number;
  current: number;
}) {
  const active = index === current;
  const done = index < current;

  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium",
          active
            ? "border-black bg-black text-white"
            : done
            ? "border-black bg-white text-black"
            : "border-gray-300 bg-white text-gray-400",
        ].join(" ")}
      >
        {index + 1}
      </div>
      <span className={active ? "font-medium text-black" : "text-gray-500"}>
        {pageTitles[index]}
      </span>
    </div>
  );
}

function getHabitLabel(habit: string) {
  switch (habit) {
    case "sleep_early":
      return "早睡";
    case "walking":
      return "散步";
    case "less_sitting":
      return "减少久坐";
    default:
      return habit;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "done":
      return "做到了";
    case "partial":
      return "部分做到";
    case "missed":
      return "没做到";
    default:
      return status;
  }
}

function getReasonLabel(reason: string | null) {
  switch (reason) {
    case "forgot":
      return "忘了";
    case "no_time":
      return "没时间";
    case "too_tired":
      return "太累了";
    case "no_motivation":
      return "不想做";
    case null:
    case "":
      return "无";
    default:
      return reason;
  }
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return value;
  }
}

export default function HealthCoachMvpPages() {
  const [page, setPage] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [apiError, setApiError] = useState("");

  const [isSavingCheckin, setIsSavingCheckin] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [riskMessage, setRiskMessage] = useState("");
  const [riskTriggered, setRiskTriggered] = useState(false);

  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [checkinHistory, setCheckinHistory] = useState<HistoryCheckin[]>([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState<HistoryAdjustment[]>([]);
  const [riskHistory, setRiskHistory] = useState<HistoryRiskEvent[]>([]);

  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(
    null
  );
  const [tomorrowAdjustment, setTomorrowAdjustment] =
    useState<TomorrowAdjustment | null>(null);

  const [form, setForm] = useState<FormState>({
    habit: "sleep_early",
    sleepTime: "00:30",
    availableTime: "晚上 22:30 之后",
    failureReason: "too_tired",
    wantsReminder: "yes",
  });

  const [checkin, setCheckin] = useState<CheckinState>({
    status: "done",
    reason: "",
    note: "",
  });

  const fallbackPlan = useMemo<GeneratedPlan>(() => {
    if (form.habit === "walking") {
      return {
        mainGoal: "每天晚饭后散步 10 分钟，7 天完成 5 天",
        supportAction: "如果下雨或不方便外出，改为室内拉伸 5 分钟",
        backupAction: "如果太累，只做 3 分钟慢走或原地活动",
      };
    }

    if (form.habit === "less_sitting") {
      return {
        mainGoal: "每坐 90 分钟起身活动 2 分钟，7 天完成 5 天",
        supportAction: "下午固定做 1 次站立拉伸 3 分钟",
        backupAction: "如果工作太忙，至少站起来接水一次",
      };
    }

    return {
      mainGoal: "23:45 前上床，7 天完成 5 天",
      supportAction: "每天晚饭后走 10 分钟",
      backupAction: "如果失败时改成：拉伸 5 分钟",
    };
  }, [form.habit]);

  const plan =
    generatedPlan?.mainGoal &&
    generatedPlan?.supportAction &&
    generatedPlan?.backupAction
      ? generatedPlan
      : fallbackPlan;

  const stats = useMemo(() => {
    const totalCheckins = checkinHistory.length;
    const doneCount = checkinHistory.filter(
      (item) => item.checkin_status === "done"
    ).length;
    const partialCount = checkinHistory.filter(
      (item) => item.checkin_status === "partial"
    ).length;
    const missedCount = checkinHistory.filter(
      (item) => item.checkin_status === "missed"
    ).length;

    const completionRate =
      totalCheckins > 0 ? Math.round((doneCount / totalCheckins) * 100) : 0;

    return {
      totalCheckins,
      doneCount,
      partialCount,
      missedCount,
      completionRate,
      riskCount: riskHistory.length,
      adjustmentCount: adjustmentHistory.length,
    };
  }, [checkinHistory, adjustmentHistory, riskHistory]);

  const nextPage = () => setPage((p) => Math.min(p + 1, 4));
  const prevPage = () => setPage((p) => Math.max(p - 1, 0));

  const resetCheckinFeedback = () => {
    setSubmitted(false);
    setSaveMessage("");
    setTomorrowAdjustment(null);
    setHistoryError("");
    setRiskMessage("");
    setRiskTriggered(false);
    setCheckin({
      status: "done",
      reason: "",
      note: "",
    });
  };

  const parseJsonResponse = async (res: Response, fallbackMessage: string) => {
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    let data: any = null;

    if (contentType.includes("application/json")) {
      data = JSON.parse(rawText);
    } else {
      throw new Error(
        `${fallbackMessage}。状态码: ${res.status}。返回内容前 200 字符: ${rawText.slice(
          0,
          200
        )}`
      );
    }

    return data;
  };

  const loadOverview = async () => {
    try {
      setIsLoadingOverview(true);
      setOverviewError("");

      const res = await fetch("/api/load-history", {
        method: "GET",
      });

      const data = await parseJsonResponse(res, "统计接口没有返回 JSON");

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || data?.details || data?.hint || "加载统计失败"
        );
      }

      setCheckinHistory(data.checkins || []);
      setAdjustmentHistory(data.adjustments || []);
      setRiskHistory(data.risks || []);
    } catch (error: any) {
      console.error("加载首页统计失败:", error);
      setOverviewError(error?.message || "加载首页统计失败");
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const handleLoadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setHistoryError("");

      const res = await fetch("/api/load-history", {
        method: "GET",
      });

      const data = await parseJsonResponse(res, "历史接口没有返回 JSON");

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || data?.details || data?.hint || "加载历史记录失败"
        );
      }

      setCheckinHistory(data.checkins || []);
      setAdjustmentHistory(data.adjustments || []);
      setRiskHistory(data.risks || []);
      setPage(4);
    } catch (error: any) {
      console.error("加载历史记录失败:", error);
      setHistoryError(error?.message || "加载历史记录失败");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const handleGeneratePlan = async () => {
    try {
      setApiError("");
      setIsLoadingPlan(true);
      setGeneratedPlan(null);
      resetCheckinFeedback();

      const res = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await parseJsonResponse(res, "计划接口没有返回 JSON");

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "生成计划失败");
      }

      if (
        typeof data?.mainGoal !== "string" ||
        typeof data?.supportAction !== "string" ||
        typeof data?.backupAction !== "string"
      ) {
        throw new Error("接口返回的数据格式不正确");
      }

      setGeneratedPlan({
        mainGoal: data.mainGoal,
        supportAction: data.supportAction,
        backupAction: data.backupAction,
      });

      setPage(2);
    } catch (error) {
      console.error(error);
      setApiError(error instanceof Error ? error.message : "生成计划失败");
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleSaveCheckin = async () => {
    try {
      setIsSavingCheckin(true);
      setSaveMessage("");
      setSubmitted(false);
      setRiskMessage("");
      setRiskTriggered(false);

      const res = await fetch("/api/save-checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form,
          plan,
          checkin,
        }),
      });

      const data = await parseJsonResponse(res, "保存接口没有返回 JSON");

      if (!res.ok || !data?.ok) {
        console.error("save-checkin API response:", data);

        throw new Error(
          [
            data?.stage && `stage=${data.stage}`,
            data?.error,
            data?.details,
            data?.hint,
            data?.cause && `cause=${data.cause}`,
            data?.code && `code=${data.code}`,
          ]
            .filter(Boolean)
            .join(" | ") || "保存失败"
        );
      }

      setSubmitted(!!data.submitted);
      setSaveMessage(data.saveMessage || "");
      setRiskTriggered(!!data.riskTriggered);
      setRiskMessage(data.riskMessage || "");
      setTomorrowAdjustment(data.tomorrowAdjustment || null);

      await loadOverview();
    } catch (error: any) {
      console.error("保存失败原始对象:", error);
      console.error("message:", error?.message);
      console.error("details:", error?.details);
      console.error("hint:", error?.hint);
      console.error("code:", error?.code);
      console.error("json:", JSON.stringify(error, null, 2));

      setSaveMessage(
        error?.message || error?.details || error?.hint || "保存失败"
      );
    } finally {
      setIsSavingCheckin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            {pageTitles.map((_, index) => (
              <StepBadge key={index} index={index} current={page} />
            ))}
          </div>
        </div>

        {page === 0 && (
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="space-y-3 p-8">
              <div className="inline-flex w-fit rounded-full border px-3 py-1 text-sm text-gray-600">
                AI 健康习惯教练 MVP
              </div>
              <CardTitle className="text-3xl md:text-4xl">
                先把一个小习惯做成，再谈改变人生
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-gray-600">
                这个原型用来帮助用户建立基础健康习惯，比如早睡、散步和减少久坐。它不是医生，也不打算装成医生。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8 pt-0">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border bg-gray-50 p-5">
                  <div className="text-sm text-gray-500">最近打卡数</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {stats.totalCheckins}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">基于最近 10 条记录</div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-5">
                  <div className="text-sm text-gray-500">完成次数</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {stats.doneCount}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    部分完成 {stats.partialCount} 次
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-5">
                  <div className="text-sm text-gray-500">完成率</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {stats.completionRate}%
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    未完成 {stats.missedCount} 次
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-5">
                  <div className="text-sm text-gray-500">风险事件数</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {stats.riskCount}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    调整建议 {stats.adjustmentCount} 条
                  </div>
                </div>
              </div>

              {overviewError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {overviewError}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border bg-gray-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold">你会得到什么</h3>
                  <ul className="space-y-2 text-sm leading-6 text-gray-700">
                    <li>• 一个 7 天健康习惯计划</li>
                    <li>• 一个清晰的小目标，而不是空泛口号</li>
                    <li>• 每日打卡与简单调整建议</li>
                    <li>• 基于真实数据的最近表现统计</li>
                  </ul>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-5">
                  <h3 className="mb-3 text-lg font-semibold">边界说明</h3>
                  <ul className="space-y-2 text-sm leading-6 text-gray-700">
                    <li>• 不提供诊断</li>
                    <li>• 不提供医疗建议</li>
                    <li>• 不提供用药建议</li>
                    <li>• 如果涉及危险症状或用药问题，应转向线下专业帮助</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="h-11 rounded-2xl px-6 text-base"
                  onClick={nextPage}
                >
                  开始使用
                </Button>

                <Button
                  variant="secondary"
                  className="h-11 rounded-2xl px-6 text-base"
                  onClick={loadOverview}
                  disabled={isLoadingOverview}
                >
                  {isLoadingOverview ? "刷新中..." : "刷新统计"}
                </Button>

                <Button
                  variant="outline"
                  className="h-11 rounded-2xl px-6 text-base"
                  onClick={handleLoadHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "加载中..." : "查看历史记录"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {page === 1 && (
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="p-8">
              <CardTitle className="text-2xl">问卷页</CardTitle>
              <CardDescription className="text-base leading-7">
                先回答 5 个问题，系统才知道该怎么给你生成一份不那么离谱的一周计划。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-8 pt-0">
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  1. 你最想改善什么习惯
                </Label>
                <RadioGroup
                  value={form.habit}
                  onValueChange={(value: Habit) =>
                    setForm((f) => ({ ...f, habit: value }))
                  }
                  className="grid gap-3"
                >
                  {habitOptions.map((item) => (
                    <label
                      key={item.value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50"
                    >
                      <RadioGroupItem value={item.value} id={item.value} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label htmlFor="sleepTime" className="text-base font-medium">
                  2. 你平时大概几点睡
                </Label>
                <Input
                  id="sleepTime"
                  value={form.sleepTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sleepTime: e.target.value }))
                  }
                  placeholder="例如 00:30"
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="availableTime" className="text-base font-medium">
                  3. 你平时什么时间最方便执行
                </Label>
                <Input
                  id="availableTime"
                  value={form.availableTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, availableTime: e.target.value }))
                  }
                  placeholder="例如 晚上 22:30 之后"
                  className="h-11 rounded-2xl"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  4. 你最常失败的原因是什么
                </Label>
                <RadioGroup
                  value={form.failureReason}
                  onValueChange={(value: FailureReason) =>
                    setForm((f) => ({ ...f, failureReason: value }))
                  }
                  className="grid gap-3"
                >
                  {failureReasons.map((item) => (
                    <label
                      key={item.value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50"
                    >
                      <RadioGroupItem
                        value={item.value}
                        id={`reason-${item.value}`}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  5. 你愿意每天接收提醒吗
                </Label>
                <RadioGroup
                  value={form.wantsReminder}
                  onValueChange={(value: ReminderChoice) =>
                    setForm((f) => ({ ...f, wantsReminder: value }))
                  }
                  className="grid gap-3"
                >
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50">
                    <RadioGroupItem value="yes" id="reminder-yes" />
                    <span>愿意</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50">
                    <RadioGroupItem value="no" id="reminder-no" />
                    <span>暂时不需要</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={prevPage}
                >
                  返回
                </Button>
                <Button
                  className="rounded-2xl"
                  onClick={handleGeneratePlan}
                  disabled={isLoadingPlan}
                >
                  {isLoadingPlan ? "生成中..." : "生成计划"}
                </Button>
              </div>

              {apiError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {apiError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {page === 2 && (
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="p-8">
              <CardTitle className="text-2xl">计划页</CardTitle>
              <CardDescription className="text-base leading-7">
                这里会优先显示 API 返回的真实计划；如果接口失败，则回退到本地假数据。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-8 pt-0 md:grid-cols-3">
              <div className="rounded-2xl border bg-gray-50 p-5 md:col-span-3">
                <div className="mb-2 text-sm text-gray-500">
                  根据问卷生成的一周计划
                </div>
                <div className="text-lg font-semibold">
                  主目标：{plan.mainGoal}
                </div>
              </div>

              <div className="rounded-2xl border p-5">
                <div className="mb-2 text-sm text-gray-500">辅助动作</div>
                <div className="text-base leading-7">{plan.supportAction}</div>
              </div>

              <div className="rounded-2xl border p-5">
                <div className="mb-2 text-sm text-gray-500">失败时改成</div>
                <div className="text-base leading-7">{plan.backupAction}</div>
              </div>

              <div className="rounded-2xl border p-5">
                <div className="mb-2 text-sm text-gray-500">你的问卷摘要</div>
                <div className="space-y-2 text-sm leading-6 text-gray-700">
                  <div>平时睡觉时间：{form.sleepTime}</div>
                  <div>方便执行时间：{form.availableTime}</div>
                  <div>
                    每日提醒：
                    {form.wantsReminder === "yes" ? "愿意接收" : "暂时不需要"}
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 flex flex-wrap gap-3 pt-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={prevPage}
                >
                  返回修改问卷
                </Button>
                <Button
                  className="rounded-2xl"
                  onClick={() => {
                    resetCheckinFeedback();
                    nextPage();
                  }}
                >
                  进入今日打卡
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {page === 3 && (
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="p-8">
              <CardTitle className="text-2xl">打卡页</CardTitle>
              <CardDescription className="text-base leading-7">
                这里是每日最关键的交互。不要搞复杂，先让用户老老实实点完提交。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-8 pt-0">
              <div className="rounded-2xl border bg-gray-50 p-5">
                <div className="text-sm text-gray-500">今日目标</div>
                <div className="mt-1 text-base font-medium">
                  {plan.mainGoal}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">今天做到了吗</Label>
                <RadioGroup
                  value={checkin.status}
                  onValueChange={(value: CheckinStatus) =>
                    setCheckin((c) => ({
                      ...c,
                      status: value,
                      reason: value === "missed" ? c.reason : "",
                    }))
                  }
                  className="grid gap-3"
                >
                  {completionOptions.map((item) => (
                    <label
                      key={item.value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50"
                    >
                      <RadioGroupItem
                        value={item.value}
                        id={`checkin-${item.value}`}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {checkin.status === "missed" && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">
                    如果没做到，选原因
                  </Label>
                  <RadioGroup
                    value={checkin.reason}
                    onValueChange={(value: "" | FailureReason) =>
                      setCheckin((c) => ({ ...c, reason: value }))
                    }
                    className="grid gap-3"
                  >
                    {failureReasons.map((item) => (
                      <label
                        key={item.value}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4 hover:bg-gray-50"
                      >
                        <RadioGroupItem
                          value={item.value}
                          id={`missed-${item.value}`}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="note" className="text-base font-medium">
                  备注（可选）
                </Label>
                <Textarea
                  id="note"
                  value={checkin.note}
                  onChange={(e) =>
                    setCheckin((c) => ({ ...c, note: e.target.value }))
                  }
                  placeholder="例如：今天加班太晚，完全不想动。"
                  className="min-h-[110px] rounded-2xl"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={prevPage}
                >
                  返回计划页
                </Button>
                <Button
                  className="rounded-2xl"
                  onClick={handleSaveCheckin}
                  disabled={isSavingCheckin}
                >
                  {isSavingCheckin ? "保存中..." : "提交按钮"}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-2xl"
                  onClick={handleLoadHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "加载中..." : "查看历史记录"}
                </Button>
              </div>

              {saveMessage && (
                <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                  {saveMessage}
                </div>
              )}

              {riskTriggered && riskMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                  <div className="text-sm font-medium">风险提示</div>
                  <div className="mt-2 text-base leading-7">{riskMessage}</div>
                </div>
              )}

              {submitted && (
                <div className="rounded-2xl border border-black bg-black p-5 text-white">
                  <div className="text-sm opacity-80">提交成功</div>
                  <div className="mt-2 text-base leading-7">
                    {checkin.status === "done" &&
                      "很好，先别自我感动，明天继续。"}
                    {checkin.status === "partial" &&
                      "部分做到也算进展。下一步应该把动作再缩小一点，提高完成率。"}
                    {checkin.status === "missed" &&
                      checkin.reason === "forgot" &&
                      "明天把提醒提前 30 分钟，减少靠记忆硬扛。"}
                    {checkin.status === "missed" &&
                      checkin.reason === "no_time" &&
                      "明天把目标减半，别再拿理想计划折磨现实日程。"}
                    {checkin.status === "missed" &&
                      checkin.reason === "too_tired" &&
                      "明天把动作换成更轻量的版本，比如拉伸 3 分钟。"}
                    {checkin.status === "missed" &&
                      checkin.reason === "no_motivation" &&
                      "明天只要求完成最小动作，先恢复执行感，不要要求自己一口气改命。"}
                    {checkin.status === "missed" &&
                      !checkin.reason &&
                      "你还没选失败原因。系统总不能替你编。"}
                  </div>
                </div>
              )}

              {tomorrowAdjustment && (
                <div className="rounded-2xl border bg-gray-50 p-5">
                  <div className="text-sm text-gray-500">明日调整建议</div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">明日主目标</div>
                      <div className="text-base font-medium">
                        {tomorrowAdjustment.tomorrowMainGoal}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">明日辅助动作</div>
                      <div className="text-base">
                        {tomorrowAdjustment.tomorrowSupportAction}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">调整原因</div>
                      <div className="text-base">
                        {tomorrowAdjustment.adjustReason}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {page === 4 && (
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="p-8">
              <CardTitle className="text-2xl">历史记录页</CardTitle>
              <CardDescription className="text-base leading-7">
                这里展示最近的打卡、调整建议和风险事件。先确认系统不是在瞎存数据，再谈体验优化。
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8 p-8 pt-0">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={prevPage}
                >
                  返回上一页
                </Button>

                <Button
                  className="rounded-2xl"
                  onClick={handleLoadHistory}
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "刷新中..." : "刷新历史记录"}
                </Button>
              </div>

              {historyError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                  {historyError}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">最近打卡</h3>
                {checkinHistory.length === 0 && !isLoadingHistory && (
                  <div className="rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600">
                    还没有打卡记录。
                  </div>
                )}
                {checkinHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-gray-500">打卡 #{item.id}</div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-gray-500">习惯类型</div>
                        <div className="text-base font-medium">
                          {getHabitLabel(item.habit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">打卡状态</div>
                        <div className="text-base font-medium">
                          {getStatusLabel(item.checkin_status)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">失败原因</div>
                        <div className="text-base">
                          {getReasonLabel(item.checkin_reason)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">当天主目标</div>
                        <div className="text-base">{item.plan_main_goal || "无"}</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <div className="text-sm text-gray-500">备注</div>
                      <div className="mt-1 text-base">{item.note || "无"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">最近调整建议</h3>
                {adjustmentHistory.length === 0 && !isLoadingHistory && (
                  <div className="rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600">
                    还没有调整建议记录。
                  </div>
                )}
                {adjustmentHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-gray-500">建议 #{item.id}</div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-gray-500">习惯类型</div>
                        <div className="text-base font-medium">
                          {getHabitLabel(item.habit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">对应状态</div>
                        <div className="text-base font-medium">
                          {getStatusLabel(item.checkin_status)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">失败原因</div>
                        <div className="text-base">
                          {getReasonLabel(item.checkin_reason)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">当天主目标</div>
                        <div className="text-base">{item.today_main_goal || "无"}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">明日主目标</div>
                        <div className="text-base">{item.tomorrow_main_goal}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">明日辅助动作</div>
                        <div className="text-base">
                          {item.tomorrow_support_action}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <div className="text-sm text-gray-500">调整原因</div>
                      <div className="mt-1 text-base">{item.adjust_reason}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">最近风险事件</h3>
                {riskHistory.length === 0 && !isLoadingHistory && (
                  <div className="rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600">
                    还没有风险事件记录。
                  </div>
                )}
                {riskHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-gray-500">风险事件 #{item.id}</div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-gray-500">来源</div>
                        <div className="text-base font-medium">{item.source}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">风险等级</div>
                        <div className="text-base font-medium">{item.risk_level}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">风险类型</div>
                        <div className="text-base">{item.risk_type}</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <div className="text-sm text-gray-500">触发内容</div>
                      <div className="mt-1 text-base">{item.trigger_text}</div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-red-50 p-4">
                      <div className="text-sm text-red-600">系统动作</div>
                      <div className="mt-1 text-base text-red-700">
                        {item.action_text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}