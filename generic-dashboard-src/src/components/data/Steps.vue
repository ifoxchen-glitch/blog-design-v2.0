<template>
  <ul class="steps">
    <li
      v-for="(step, index) in steps"
      :key="index"
      :class="[
        'step',
        currentStep >= index + 1 && 'step-primary',
        currentStep === index + 1 && 'step-active',
        currentStep > index + 1 && 'step-success',
      ]"
    >
      <slot name="icon" :step="step" :index="index">
        <span class="step-icon">{{ index + 1 }}</span>
      </slot>
      <div class="step-content">
        <div class="step-title">{{ step.title }}</div>
        <div v-if="step.description" class="step-description">{{ step.description }}</div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">

interface Step {
  title: string
  description?: string
}

defineProps<{
  steps: Step[]
  currentStep: number
}>()
</script>

<style scoped>
.steps {
  display: flex;
  gap: 0;
}

.step {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 2rem;
}

.step::before {
  content: '';
  position: absolute;
  top: 0.625rem;
  left: 50%;
  right: -50%;
  height: 2px;
  background: oklch(var(--b3));
}

.step:last-child::before {
  display: none;
}

.step-primary::before {
  background: oklch(var(--p));
}

.step-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: oklch(var(--b2));
  border: 2px solid oklch(var(--b3));
  font-weight: 600;
  font-size: 0.875rem;
}

.step-active .step-icon,
.step-success .step-icon {
  background: oklch(var(--p));
  border-color: oklch(var(--p));
  color: oklch(var(--pc));
}

.step-success .step-icon {
  background: oklch(var(--su));
  border-color: oklch(var(--su));
  color: oklch(var(--suc));
}

.step-content {
  margin-top: 0.5rem;
  text-align: center;
}

.step-title {
  font-weight: 500;
  font-size: 0.875rem;
}

.step-description {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}
</style>
