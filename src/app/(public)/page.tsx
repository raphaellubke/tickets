import Hero from "@/components/Hero/Hero";
import FeaturedEvents from "@/components/FeaturedEvents/FeaturedEvents";
import EventList from "@/components/EventList/EventList";
import RecoveryRedirect from "./RecoveryRedirect";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <RecoveryRedirect />
      <Hero />
      <FeaturedEvents />
      <EventList />
    </main>
  );
}
