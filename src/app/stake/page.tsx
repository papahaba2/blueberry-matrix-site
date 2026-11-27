"use client";

import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import StakeAdminPanel from "@/components/stake-admin-panel";
import StakeForm from "@/components/stake-form";
import {
  STAKING_ABI,
  STAKING_ADDRESS,
  STAKING_OWNER_ADDRESS,
  isStakingConfigured,
} from "@/config";

export default function StakePage() {
  const { address: account } = useAccount();
  const { data: owner } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: "owner",
    query: { enabled: isStakingConfigured() },
  });

  const ownerAddress = (owner as Address | undefined) ?? STAKING_OWNER_ADDRESS;
  const isAdmin =
    isStakingConfigured() &&
    Boolean(account) &&
    Boolean(ownerAddress) &&
    account!.toLowerCase() === ownerAddress.toLowerCase();

  return (
    <div className="page-shell py-10 md:py-16">
      <div className="eyebrow flex items-center gap-3">
        <span className="h-px w-8 bg-brand/70" />
        Liquid staking
      </div>
      <h1 className="mt-5 max-w-[820px] font-display text-[clamp(2.6rem,6vw,5rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
        Stake bbWFUSE.
        <br />
        <span className="text-brand-soft">Earn Berry.</span>
      </h1>
      <p className="mt-5 max-w-[560px] text-[13px] leading-6 text-muted">
        Stake the existing bbWFUSE receipt token and earn Berry. Need bbWFUSE?
        Mint it through the WFUSE vault first, then approve it here.
      </p>
      <div className="mt-8">
        <StakeForm />
      </div>
      <StakeAdminPanel isAdmin={isAdmin} />
    </div>
  );
}
