# Survival Analysis & Close-Time Estimation Methodology

This document outlines the statistical foundation for Compton's deal close-time prediction, the Wilson Score confidence interval formulation, and the formal decision criteria regarding advanced survival models (Cox Proportional Hazards and Weibull).

---

## 1. Mathematical Formulation

To estimate the probability that an active deal will close within the next $H$ days given that it has already been open for $t$ days:

$$P(t \le T \le t + H \mid T \ge t) = \frac{\#\{ d \in \mathcal{S}_{\text{stage}}(t) : \text{duration}(d) \le t + H \}}{|\mathcal{S}_{\text{stage}}(t)|}$$

Where:
- $\mathcal{S}_{\text{stage}}(t) = \{ d \in \text{Historical Won Deals in Stage} : \text{duration}(d) \ge t \}$ is the **at-risk reference class** (deals that were still open at day $t$).
- Deals that closed prior to $t$ are correctly excluded because they belong to a faster, non-comparable survival cohort.

---

## 2. Wilson Score 95% Confidence Intervals

Standard normal confidence intervals ($\hat{p} \pm 1.96 \sqrt{\frac{\hat{p}(1-\hat{p})}{n}}$) break down when sample sizes are small ($n < 20$) or probabilities are near 0% or 100%, producing impossible intervals like $[-5\%, 22\%]$.

We implement the **Asymmetric Wilson Score Interval** ($z = 1.96$):

$$p_{\text{lower}}, p_{\text{upper}} = \frac{\hat{p} + \frac{z^2}{2n} \pm z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}$$

### Key Benefits:
1. **Guaranteed Boundedness:** Interval is strictly contained within $[0\%, 100\%]$.
2. **Transparent Uncertainty:** When sample size is small (e.g. $n = 6$), the interval expands naturally (e.g. $33\%$ [95% CI: $9.7\% - 70.0\%$]), immediately signaling to leadership that the point estimate has high variance.

---

## 3. Documented Decision Point: Cox PH & Weibull Evaluation

### Question: Should we replace Discrete Kaplan-Meier with Cox Proportional Hazards or Weibull?

### Evaluation & Protocol:
- **Cox Proportional Hazards:** Assumes hazard ratio $h(t | X) = h_0(t) \exp(X\beta)$ is constant over time ($H_0: \text{PH holds}$).
- **Sample Requirements:** Requires $\ge 20$ event observations per covariate parameter ($\approx 300-400$ closed won deals per stage slice).
- **Current Volume:** With ~1,200 total deals distributed across 6 stages and multiple sales reps, stage-specific event counts for higher-order interactions are $n \approx 15-40$.

> [!NOTE]
> **Decision Rule:**
> 1. **Current Production Standard:** Stage-Stratified Discrete Kaplan-Meier with Wilson CIs is retained because it makes zero distributional assumptions, has zero hazard ratio proportional risk violations, and runs in sub-millisecond Node.js execution.
> 2. **Cox / Weibull Transition Trigger:** Re-evaluate only when total closed deal volume reaches $\ge 3,500$ deals AND the proportional hazards Schoenfeld residuals test passes ($p > 0.05$).
