<script lang="ts">
	import Bounded from '$lib/components/Bounded.svelte';

	let submitting = $state(false);
	let success = $state(false);
	let error = $state('');
	let emailMatch = $state(true);

	// Time options for the dropdown
	const timeOptions = [
		'10:00 AM',
		'10:30 AM',
		'11:00 AM',
		'11:30 AM',
		'12:00 PM',
		'12:30 PM',
		'1:00 PM',
		'1:30 PM',
		'2:00 PM',
		'2:30 PM',
		'3:00 PM',
		'3:30 PM',
		'4:00 PM',
		'4:30 PM',
		'5:00 PM',
		'5:30 PM',
		'6:00 PM',
		'6:30 PM'
	];

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

	async function handleSubmit(event: Event) {
		event.preventDefault();
		submitting = true;
		success = false;
		error = '';

		const form = event.target as HTMLFormElement;
		const formData = new FormData(form);

		// Validate email match
		const email = formData.get('email') as string;
		const confirmEmail = formData.get('confirmEmail') as string;
		
		if (!validateEmailMatch(email, confirmEmail)) {
			error = 'Email addresses do not match';
			submitting = false;
			return;
		}

		try {
			const response = await fetch('/api/send-email', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.success) {
				success = true;
				form.reset();
			} else {
				error = result.error || 'Failed to send reservation request';
			}
		} catch (err) {
			error = 'Failed to send reservation request';
		} finally {
			submitting = false;
		}
	}
</script>

<Bounded tag="section" class="bg-ink-noise font-body text-chalk">
	<div class="mx-auto max-w-4xl">
		<div class="text-center mb-12">
			<h2 class="text-4xl md:text-5xl font-display font-black text-chalk mb-4">
				Large Group Reservation
			</h2>
			<!-- <p class="text-lg max-w-2xl mx-auto">
				If your group is over 10 people, please fill out the form below.
			</p> -->
		</div>

		<div class="rounded-xl border border-white/10 bg-ink p-6 md:p-8">
			<form method="POST" action="/api/send-email" onsubmit={handleSubmit}>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<!-- Organizer Name -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Organizer Name *</span>
						<input 
							name="organizerName" 
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright {!emailMatch ? 'border-red-bright' : ''}"
							type="email" 
							placeholder="john@example.com" 
							required 
							oninput={(e) => {
								const email = (document.querySelector('input[name="email"]') as HTMLInputElement)?.value;
								validateEmailMatch(email, (e.target as HTMLInputElement)?.value || '');
							}}
						/>
						{#if !emailMatch}
							<p class="text-red-bright text-sm mt-1">Email addresses do not match</p>
						{/if}
					</label>

					<!-- Organization Name (Optional) -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Organization Name</span>
						<input 
							name="organization" 
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
							type="text" 
							placeholder="Business Inc." 
						/>
					</label>

					<!-- Number of People -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Number of People *</span>
						<input 
							name="peopleCount" 
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
							type="number" 
							placeholder="25" 
							min="1"
							required 
						/>
					</label>

					<!-- Date -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Preferred Date *</span>
						<input
							name="date"
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright [color-scheme:light]"
							type="date"
							required
						/>
					</label>

					<!-- Time -->
					<label class="label py-2">
						<span class="text-chalk/70 font-medium">Preferred Time *</span>
						<select 
							name="time" 
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
							class="input border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright" 
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
				<label class="label py-2 mt-6">
					<span class="text-chalk/70 font-medium">Additional Requirements</span>
					<textarea
						name="additionalRequirements"
						class="textarea border border-white/10 bg-chalk text-ink placeholder:text-ink/40 focus:border-red-bright"
						placeholder="Any special requests, dietary restrictions, accessibility needs, or other requirements..."
						rows="4"
					></textarea>
				</label>

				<!-- Submit Button -->
				<div class="mt-8 text-center">
					<button
						type="submit"
						class="rounded-xl bg-gradient-to-br {success ? 'from-green-700 to-green-600 hover:shadow-green-700/40' : 'from-red to-red-bright hover:shadow-red/40'} px-8 py-4 font-display text-xl font-black text-chalk hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={submitting || !emailMatch}
					>
						{submitting ? 'Submitting...' : success ? 'Request Sent ✓' : 'Submit Reservation Request'}
					</button>

					{#if success}
						<p role="status" class="mx-auto mt-6 max-w-xl rounded-xl border border-green-500 bg-green-700 px-6 py-4 text-lg font-medium text-chalk">
							Reservation request sent successfully! We'll get back to you within 24 hours.
						</p>
					{:else if error}
						<p class="mt-6 text-red-bright text-lg font-medium">{error}</p>
					{/if}
				</div>
			</form>
		</div>
	</div>
</Bounded>
