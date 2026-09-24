import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { randomToken } from "@/lib/server/random";
import { consumerClaimSchema } from "@/schemas/consumerClaim";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = consumerClaimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisa los datos ingresados.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const code = `LR-${new Date().getFullYear()}-${randomToken(4).toUpperCase()}`;
  try {
    await adminDb.collection("consumerClaims").doc(code).create({
      ...parsed.data,
      code,
      status: "RECIBIDO",
      createdAt: new Date(),
    });
    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    console.error("[consumer-claims] unable to save claim", error);
    return NextResponse.json({ error: "No se pudo registrar el caso. Inténtalo nuevamente." }, { status: 503 });
  }
}
