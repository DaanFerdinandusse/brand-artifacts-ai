import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  IconCompileInputSchema,
  IconPresetApplyInputSchema,
  IconValidateInputSchema,
} from "@/app/lib/iconSpec/schema";
import { ICONSPEC_AGENT_SYSTEM_PROMPT } from "@/app/lib/iconSpec/agentPrompt";
import { iconPresetList } from "@/app/lib/iconSpec/tools/presetList";
import { iconPresetApplyTool } from "@/app/lib/iconSpec/tools/presetApply";
import { iconValidate } from "@/app/lib/iconSpec/tools/validate";
import { iconCompileSvgTool } from "@/app/lib/iconSpec/tools/compileSvg";

const client = new Anthropic();

const tools = [
  {
    name: "icon.preset.list",
    description: "List available icon presets and recommended sizes.",
    input_schema: {
      type: "object",
      properties: {
        docType: { type: "string", const: "iconPresetQuery" },
      },
    },
  },
  {
    name: "icon.preset.apply",
    description:
      "Apply a preset to an IconDraft, normalize geometry, and return an expanded spec.",
    input_schema: {
      type: "object",
      properties: {
        docType: { type: "string", const: "iconPresetApplyRequest" },
        draft: { type: "object" },
        options: { type: "object" },
      },
      required: ["draft"],
    },
  },
  {
    name: "icon.validate",
    description: "Validate an expanded icon spec and return issues/metrics.",
    input_schema: {
      type: "object",
      properties: {
        docType: { type: "string", const: "iconValidateRequest" },
        spec: { type: "object" },
      },
      required: ["spec"],
    },
  },
  {
    name: "icon.compileSvg",
    description: "Compile an expanded icon spec into deterministic SVG output.",
    input_schema: {
      type: "object",
      properties: {
        docType: { type: "string", const: "iconCompileSvgRequest" },
        spec: { type: "object" },
        options: { type: "object" },
      },
      required: ["spec"],
    },
  },
];

const MAX_TURNS = 8;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    const messages: Array<Record<string, unknown>> = [
      {
        role: "user",
        content: `Create an icon for: ${prompt}`,
      },
    ];

    const toolState: {
      draft?: unknown;
      expanded?: unknown;
      validation?: unknown;
      compile?: unknown;
      changes?: unknown;
    } = {};

    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: ICONSPEC_AGENT_SYSTEM_PROMPT,
        messages,
        tools,
      });

      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter(
        (block: { type: string }) => block.type === "tool_use"
      ) as Array<{
        id: string;
        name: string;
        input: unknown;
      }>;

      if (toolUses.length === 0) {
        break;
      }

      for (const toolUse of toolUses) {
        let result: unknown;
        if (toolUse.name === "icon.preset.list") {
          result = iconPresetList();
        } else if (toolUse.name === "icon.preset.apply") {
          const parsed = IconPresetApplyInputSchema.parse(toolUse.input);
          const applyResult = iconPresetApplyTool(parsed);
          result = {
            docType: "iconPresetApplyResponse",
            expanded: applyResult.expanded,
            changes: applyResult.changes,
          };
          toolState.draft = parsed.draft;
          toolState.expanded = applyResult.expanded;
          toolState.changes = applyResult.changes;
        } else if (toolUse.name === "icon.validate") {
          const parsed = IconValidateInputSchema.parse(toolUse.input);
          const expanded = "spec" in parsed ? parsed.spec : parsed.expanded;
          const validation = iconValidate(expanded);
          result = {
            docType: "iconValidateResponse",
            ok: validation.valid,
            issues: validation.issues,
            metrics: validation.metrics,
          };
          toolState.expanded = expanded;
          toolState.validation = validation;
        } else if (toolUse.name === "icon.compileSvg") {
          const parsed = IconCompileInputSchema.parse(toolUse.input);
          const expanded = "spec" in parsed ? parsed.spec : parsed.expanded;
          const compile = iconCompileSvgTool({ expanded });
          result = compile.ok
            ? {
                docType: "iconCompileSvgResponse",
                svg: compile.svg,
                svgMin: compile.svgMin,
                metadata: compile.metadata,
              }
            : {
                docType: "iconCompileSvgResponse",
                svg: "",
                svgMin: "",
                issues: compile.issues,
                metadata: {
                  size: expanded.size,
                  viewBox: expanded.viewBox,
                  pathCount: expanded.geometry.paths.length,
                  totalPathCommands: 0,
                  strokeWidth: expanded.style.strokeWidth,
                  padding: expanded.constraints.padding,
                },
              };
          toolState.expanded = expanded;
          toolState.compile = compile;
        } else {
          throw new Error(`Unknown tool: ${toolUse.name}`);
        }

        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            },
          ],
        });
      }

      if ((toolState.compile as { ok?: boolean })?.ok) {
        break;
      }
    }

    if (!toolState.compile) {
      return NextResponse.json(
        { error: "Tool loop did not produce a compiled icon." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      draft: toolState.draft,
      expanded: toolState.expanded,
      validation: toolState.validation,
      compile: toolState.compile,
      changes: toolState.changes,
    });
  } catch (error) {
    console.error("Icon generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
