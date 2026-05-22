import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

gsap.registerPlugin(ScrollTrigger)
gsap.registerPlugin(ScrollToPlugin)
gsap.registerPlugin(MotionPathPlugin)

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.use(gsap);

    return { provide: { gsap, ScrollTrigger, ScrollToPlugin, MotionPathPlugin } };
});
