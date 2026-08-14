import 'package:flutter/material.dart';
import '../services/api_client.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});
  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final _api = ApiClient();
  String _name = 'LOGIX user';
  String? _error;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final user = await _api.me(); if (mounted) setState(() => _name = user.name.isEmpty ? user.email : user.name); } on ApiException catch (e) { if (mounted) setState(() => _error = e.message); } }
  Future<void> _logout() async { await _api.logout(); if (mounted) Navigator.of(context).pushNamedAndRemoveUntil('/', (_) => false); }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('LOGIX Dashboard'), actions: [IconButton(onPressed: _logout, icon: const Icon(Icons.logout), tooltip: 'Log out')]),
        body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [
          Text('Welcome, $_name', style: Theme.of(context).textTheme.headlineSmall),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          const SizedBox(height: 20),
          const _MetricCard(title: 'Inventory Intelligence', subtitle: 'Dashboard and material risk views are governed by backend permissions.', icon: Icons.inventory_2_outlined),
          const _MetricCard(title: 'Logistics Intelligence', subtitle: 'Shipment, carrier, freight, timing, and risk journeys are prepared for API integration.', icon: Icons.local_shipping_outlined),
          const _MetricCard(title: 'Traceability', subtitle: 'Audit and lineage data remain server-enforced and role-scoped.', icon: Icons.fact_check_outlined),
        ]),),
      );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.title, required this.subtitle, required this.icon});
  final String title; final String subtitle; final IconData icon;
  @override
  Widget build(BuildContext context) => Card(child: ListTile(leading: Icon(icon), title: Text(title), subtitle: Text(subtitle)));
}
