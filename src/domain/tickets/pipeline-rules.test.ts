import { describe, expect, it } from "vitest";
import { buildTicket } from "@/test/ticket-fixture";
import { enPipeline } from "./pipeline-rules";

describe("enPipeline", () => {
  it("deja fuera los tickets excluidos", () => {
    const normal = buildTicket({ id: "a" });
    const excluido = buildTicket({ id: "b", excluidoDelPipeline: true });
    expect(enPipeline([normal, excluido])).toEqual([normal]);
  });

  it("conserva los que nunca tuvieron la marca o la tienen en false", () => {
    const sinMarca = buildTicket({ id: "a" });
    const falso = buildTicket({ id: "b", excluidoDelPipeline: false });
    expect(enPipeline([sinMarca, falso])).toEqual([sinMarca, falso]);
  });
});
