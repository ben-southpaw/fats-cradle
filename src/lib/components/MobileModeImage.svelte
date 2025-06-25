<script>
  import { isDesktop } from '$lib/stores/breakpoint';
  import modelJpg from '$lib/images/model.jpg?url';
</script>

<div class="mobile-mode" class:visible={!$isDesktop}>
  <img src={modelJpg} alt="Model" />
</div>

<style>
  .mobile-mode {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    pointer-events: none;
  }
  
  .mobile-mode.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .mobile-mode img {
    object-fit: contain;
    width: 100%;
    height: 100%;
  }
</style>