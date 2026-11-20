<script lang="ts">
	import Bounded from '$lib/components/Bounded.svelte';
	import { EMAIL_MISMATCH_MESSAGE, GROUP_TIME_OPTIONS } from '$lib/formOptions';

	let submitting = $state(false);
	let success = $state(false);
	let error = $state('');
	let emailMatch = $state(true);

	const timeOptions = GROUP_TIME_OPTIONS;

	// Game type options
	const gameTypeOptions = [
		{ value: 'board-games', label: 'Board Games' },
		{ value: 'video-games', label: 'Video Games' },
		{ value: 'both', label: 'Both' }
	];

	// Payment arrangement options
	const paymentOptions = [
		{ value: 'individual', label: 'Paid individually' },
		{ value: 'one-bill', label: 'All on one bill' },
		{ value: 'other', label: 'Other' }
	];

	function validateEmailMatch(email: string, confirmEmail: string) {
		emailMatch = email === confirmEmail;
		return emailMatch;
	}

	function handleEmailInput(event: Event) {
		const form = (event.currentTarget as HTMLInputElement).form;
		if (!form) return;
		const email = (form.elements.namedItem('email') as HTMLInputElement).value;
		const confirmEmail = (form.elements.namedItem('confirmEmail') as HTMLInputElement).value;
		emailMatch = !confirmEmail || email === confirmEmail;
		if (emailMatch && error === EMAIL_MISMATCH_MESSAGE) error = '';
	}

	let submissionId = '';

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		success = false;
		error = '';

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);
		submissionId ||= crypto.randomUUID();
		formData.set('submissionId', submissionId);

		// Validate email match
		const email = formData.get('email') as string;
		const confirmEmail = formData.get('confirmEmail') as string;

		if (!validateEmailMatch(email, confirmEmail)) {
			error = EMAIL_MISMATCH_MESSAGE;
			submitting = false;
			return;
		}

		try {
			const response = await fetch('/api/send-email', {
				method: 'POST',
				body: formData
			});

			if (response.status === 429) {
				error = 'Too many requests. Please wait a few minutes and try again.';
				return;
			}
			const result = await response.json();

			if (response.ok && result.success) {
				success = true;
				form.reset();
				submissionId = '';
			} else {
				error = result.error || 'Failed to send reservation request';
			}
		} catch {
			error = 'Failed to send reservation request';
		} finally {
			submitting = false;
		}
	}
</script>

<Bounded tag="section" class="bg-ink-noise font-body text-chalk">
	<div class="mx-auto max-w-4xl">
		<div class="mb-12 text-center">
			<h2 class="mb-4 font-display text-4xl font-black text-chalk md:text-5xl">
				Large Group Reservation
			</h2>
			<!-- <p class="text-lg max-w-2xl mx-auto">
				If your group is over 10 people, please fill out the form below.
			</p> -->
		</div>

		<div class="rounded-xl border border-white/10 bg-ink p-6 md:p-8">
			<form method="POST" action="/api/send-email" onsubmit={handleSubmit}>
				<label class="sr-only">
					Leave this field blank
					<input
						name="companyWebsite"
						type="text"
						tabindex="-1"
						autocomplete="off"
						maxlength="200"
					/>
				</label>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<!-- Organizer Name -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Organizer Name *</span>
						<input
							name="organizerName"
							maxlength="120"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							type="text"
							placeholder="John Doe"
							required
						/>
					</label>

					<!-- Contact Phone -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Contact Phone Number *</span>
						<input
							name="phone"
							maxlength="50"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							type="tel"
							placeholder="(555) 123-4567"
							required
						/>
					</label>

					<!-- Contact Email -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Contact Email Address *</span>
						<input
							name="email"
							oninput={handleEmailInput}
							maxlength="254"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							type="email"
							placeholder="john@example.com"
							required
						/>
					</label>

					<!-- Confirm Email -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Confirm Email Address *</span>
						<input
							name="confirmEmail"
							maxlength="254"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright {!emailMatch
								? 'border-red-bright'
								: ''}"
							type="email"
							placeholder="john@example.com"
							required
							oninput={handleEmailInput}
						/>
						{#if !emailMatch}
							<p class="mt-1 text-sm text-red-bright">{EMAIL_MISMATCH_MESSAGE}</p>
						{/if}
					</label>

					<!-- Organization Name (Optional) -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Organization Name</span>
						<input
							name="organization"
							maxlength="200"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							type="text"
							placeholder="Business Inc."
						/>
					</label>

					<!-- Number of People -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Number of People *</span>
						<input
							name="peopleCount"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							type="number"
							placeholder="25"
							min="1"
							max="9999"
							step="1"
							required
						/>
					</label>

					<!-- Date -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Preferred Date *</span>
						<input
							name="date"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink [color-scheme:light] focus:border-red-bright"
							type="date"
							required
						/>
					</label>

					<!-- Time -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Preferred Time *</span>
						<select
							name="time"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							required
						>
							<option value="">Select a time</option>
							{#each timeOptions as time}
								<option value={time}>{time}</option>
							{/each}
						</select>
					</label>

					<!-- Game Type -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Game Type *</span>
						<select
							name="gameType"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							required
						>
							<option value="">Select game type</option>
							{#each gameTypeOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<!-- Payment Arrangements -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Payment Arrangements *</span>
						<select
							name="paymentArrangements"
							class="placeholder:text-ink/40 input border border-white/10 bg-chalk text-ink focus:border-red-bright"
							required
						>
							<option value="">Select payment option</option>
							{#each paymentOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
				</div>

				<!-- Additional Requirements -->
				<label class="label mt-6 py-2">
					<span class="text-chalk/70 font-medium">Additional Requirements</span>
					<textarea
						name="additionalRequirements"
						maxlength="5000"
						class="placeholder:text-ink/40 textarea border border-white/10 bg-chalk text-ink focus:border-red-bright"
						placeholder="Any special requests, dietary restrictions, accessibility needs, or other requirements..."
						rows="4"
					></textarea>
				</label>

				<!-- Submit Button -->
				<div class="mt-8 text-center">
					<button
						type="submit"
						class="rounded-xl bg-gradient-to-br {success
							? 'from-green-700 to-green-600 hover:shadow-green-700/40'
							: 'hover:shadow-red/40 from-red to-red-bright'} px-8 py-4 font-display text-xl font-black text-chalk transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
						disabled={submitting || !emailMatch}
					>
						{submitting
							? 'Submitting...'
							: success
								? 'Request Sent ✓'
								: 'Submit Reservation Request'}
					</button>

					{#if success}
						<p
							role="status"
							class="mx-auto mt-6 max-w-xl rounded-xl border border-green-500 bg-green-700 px-6 py-4 text-lg font-medium text-chalk"
						>
							Reservation request sent successfully! We'll get back to you within 24 hours.
						</p>
					{:else if error}
						<p role="alert" class="mt-6 text-lg font-medium text-red-bright">{error}</p>
					{/if}
				</div>
			</form>
		</div>
	</div>
</Bounded>
