import { redirect } from "next/navigation";

export default function TransactionRedirect() {
  redirect("/transactions");
}

