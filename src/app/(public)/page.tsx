import Hero from "@/components/Hero/Hero";
import SponsoredEvent from "@/components/SponsoredEvent/SponsoredEvent";
import FeaturedEvents from "@/components/FeaturedEvents/FeaturedEvents";
import EventList from "@/components/EventList/EventList";
import WhyBuyWithUs from "@/components/WhyBuyWithUs/WhyBuyWithUs";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <Hero />
      <FeaturedEvents />
      <SponsoredEvent />
      <EventList />
      <WhyBuyWithUs />
    </main>
  );
}
