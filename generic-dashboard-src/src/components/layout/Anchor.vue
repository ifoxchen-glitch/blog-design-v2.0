<template>
  <div class="anchor">
    <div class="anchor-link-container">
      <div
        v-for="link in links"
        :key="link.id"
        :class="['anchor-link', activeId === link.id && 'active']"
      >
        <a :href="'#' + link.id" @click.prevent="scrollTo(link.id)">
          {{ link.title }}
        </a>
        <div v-if="link.children" class="anchor-children">
          <a
            v-for="child in link.children"
            :key="child.id"
            :href="'#' + child.id"
            :class="['anchor-link-child', activeId === child.id && 'active']"
            @click.prevent="scrollTo(child.id)"
          >
            {{ child.title }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface AnchorLink {
  id: string
  title: string
  children?: AnchorLink[]
}

const props = defineProps<{
  links: AnchorLink[]
}>()

const activeId = ref('')

const scrollTo = (id: string) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeId.value = id
  }
}

const handleScroll = () => {
  const allIds = props.links.flatMap(link => [
    link.id,
    ...(link.children?.map(c => c.id) || [])
  ])
  
  for (const id of allIds) {
    const element = document.getElementById(id)
    if (element) {
      const rect = element.getBoundingClientRect()
      if (rect.top >= 0 && rect.top <= 100) {
        activeId.value = id
        break
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.anchor {
  position: relative;
}

.anchor-link-container {
  position: relative;
}

.anchor-link {
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.anchor-link a {
  color: oklch(var(--bc) / 0.7);
  text-decoration: none;
  transition: color 0.2s;
}

.anchor-link a:hover {
  color: oklch(var(--p));
}

.anchor-link.active > a {
  color: oklch(var(--p));
  font-weight: 500;
}

.anchor-children {
  padding-left: 1rem;
  margin-top: 0.25rem;
}

.anchor-link-child {
  display: block;
  padding: 0.125rem 0;
  font-size: 0.75rem;
  color: oklch(var(--bc) / 0.6);
  text-decoration: none;
}

.anchor-link-child:hover {
  color: oklch(var(--p));
}

.anchor-link-child.active {
  color: oklch(var(--p));
}
</style>
