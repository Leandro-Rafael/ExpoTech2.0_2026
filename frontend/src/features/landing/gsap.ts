/** GSAP + ScrollTrigger registrados. Importe SÓ de módulos lazy (vai para o chunk "scroll"). */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
