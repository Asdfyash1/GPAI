import { SharedPage } from "@/components/SharedPage";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  return <SharedPage slug={slug} />;
}
