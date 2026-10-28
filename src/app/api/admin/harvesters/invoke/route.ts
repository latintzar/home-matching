import { NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Valid Lambda function names
const VALID_LAMBDAS = [
  "lf-harvest-delta",
  "tc-harvest-delta",
  "c21-harvest-delta",
  "dp-harvest-delta",
  "ev-harvest-delta",
  "remax-harvest-delta",
  "aproperties-harvest-delta",
];

export async function POST(request: Request) {
  try {
    const { lambda } = await request.json();

    if (!lambda || !VALID_LAMBDAS.includes(lambda)) {
      return NextResponse.json(
        { error: `Invalid lambda: ${lambda}. Valid options: ${VALID_LAMBDAS.join(", ")}` },
        { status: 400 }
      );
    }

    console.log(`[Admin] Invoking Lambda: ${lambda}`);

    const result = await lambdaClient.send(new InvokeCommand({
      FunctionName: lambda,
      InvocationType: "Event", // Async invocation
      Payload: JSON.stringify({}),
    }));

    return NextResponse.json({
      success: true,
      lambda,
      statusCode: result.StatusCode,
      message: `Lambda ${lambda} invoked successfully (async)`,
      invokedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Lambda invoke error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to invoke Lambda" },
      { status: 500 }
    );
  }
}
